import { SupabaseClient } from "@supabase/supabase-js";
import { getQBTokens, qbApi } from "@/app/api/qb/lib";
import { sendViaResend } from "@/lib/growth/resendx";

/**
 * Invoice chaser (Darrin 10/29/26: "sending and resending the quickbooks invoice
 * with the payment link"). Once a day:
 *   - an open invoice QuickBooks never emailed  -> QB sends it (first)
 *   - an open invoice last emailed >= resend_days ago -> QB sends it again (resend)
 *   - after max_resends of our resends it is left alone and listed for Darrin
 * QB's own /send is used so the email carries the Pay now link. Paid invoices
 * (Balance 0) never show up. A summary goes to Darrin after every live run.
 */

const DAY = 86400000;
const SUMMARY_TO = "darrinjco@gmail.com";

export type ChaseItem = {
  id: string; doc: string; customer: string; email: string | null; balance: number;
  txnDate: string; dueDate: string | null; lastSent: string | null; ourResends: number;
  action: "first" | "resend" | "wait" | "maxed" | "no_email" | "excluded" | "too_old";
  note?: string;
};

export async function loadChaserSettings(sb: SupabaseClient) {
  const { data } = await sb.from("invoice_chaser_settings").select("*").eq("id", "default").single();
  if (!data) throw new Error("invoice_chaser_settings row missing (run migration 0019)");
  return data;
}

async function openInvoices(realm: string, token: string) {
  const out: any[] = [];
  for (let start = 1; ; start += 1000) {
    const q = `SELECT * FROM Invoice WHERE Balance > '0' STARTPOSITION ${start} MAXRESULTS 1000`;
    const r = await qbApi(realm, token, `query?query=${encodeURIComponent(q)}&minorversion=75`);
    const rows = r?.QueryResponse?.Invoice || [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function planChase(sb: SupabaseClient, now = new Date()) {
  const s = await loadChaserSettings(sb);
  const tok = await getQBTokens();
  if (!tok) throw new Error("QuickBooks is disconnected (reconnect in the wholesale admin)");
  const invoices = await openInvoices(tok.realm_id, tok.access_token);

  const { data: log } = await sb.from("invoice_chaser_log").select("invoice_id,kind,sent_at");
  const resends: Record<string, number> = {};
  const lastOurs: Record<string, string> = {};
  for (const l of log || []) {
    if (l.kind === "resend") resends[l.invoice_id] = (resends[l.invoice_id] || 0) + 1;
    if (!lastOurs[l.invoice_id] || l.sent_at > lastOurs[l.invoice_id]) lastOurs[l.invoice_id] = l.sent_at;
  }
  const excluded = new Set((s.exclude_customers || []).map((x: string) => x.toLowerCase()));

  const items: ChaseItem[] = invoices.map((inv) => {
    const id = String(inv.Id);
    const qbSent = inv.EmailStatus === "EmailSent" ? inv.DeliveryInfo?.DeliveryTime || null : null;
    const lastSent = [qbSent, lastOurs[id] || null].filter(Boolean).sort().pop() || null;
    const it: ChaseItem = {
      id, doc: inv.DocNumber || id, customer: inv.CustomerRef?.name || "?",
      email: inv.BillEmail?.Address || null, balance: Number(inv.Balance),
      txnDate: inv.TxnDate, dueDate: inv.DueDate || null, lastSent, ourResends: resends[id] || 0, action: "wait",
    };
    const ageDays = (now.getTime() - new Date(inv.TxnDate + "T12:00:00Z").getTime()) / DAY;
    if (excluded.has(it.customer.toLowerCase())) it.action = "excluded";
    else if (ageDays > s.window_days) it.action = "too_old";
    else if (!it.email) it.action = "no_email";
    else if (!lastSent) it.action = "first";
    else if (it.ourResends >= s.max_resends) it.action = "maxed";
    else if (now.getTime() - new Date(lastSent).getTime() >= s.resend_days * DAY) it.action = "resend";
    return it;
  });
  items.sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  return { settings: s, items, token: tok };
}

/** live=false only plans. live=true sends via QuickBooks and logs each send. */
export async function runChase(sb: SupabaseClient, opts: { live: boolean; only?: string[] }) {
  const { items, token } = await planChase(sb);
  const due = items.filter((i) => (i.action === "first" || i.action === "resend") && (!opts.only || opts.only.includes(i.doc)));
  const sent: ChaseItem[] = [];
  const failed: { item: ChaseItem; error: string }[] = [];
  if (opts.live) {
    for (const it of due) {
      try {
        await qbApi(token.realm_id, token.access_token, `invoice/${it.id}/send?minorversion=75`, "POST");
        await sb.from("invoice_chaser_log").insert({
          invoice_id: it.id, doc_number: it.doc, customer: it.customer, email: it.email, balance: it.balance, kind: it.action,
        });
        sent.push(it);
      } catch (e: any) {
        failed.push({ item: it, error: String(e.message).slice(0, 200) });
      }
    }
    if (sent.length || failed.length) await sendSummary(sent, failed, items.filter((i) => i.action === "maxed"));
  }
  return { items, due, sent, failed };
}

const money = (n: number) => `$${n.toFixed(2)}`;

async function sendSummary(sent: ChaseItem[], failed: { item: ChaseItem; error: string }[], maxed: ChaseItem[]) {
  const line = (i: ChaseItem) => `#${i.doc}  ${i.customer}  ${money(i.balance)}  (${i.action === "first" ? "first send" : `resend ${i.ourResends + 1}`}) -> ${i.email}`;
  const parts = [
    `Invoice chaser sent ${sent.length} QuickBooks invoice${sent.length === 1 ? "" : "s"} today:`, "", ...sent.map(line),
  ];
  if (failed.length) parts.push("", "FAILED:", ...failed.map((f) => `${line(f.item)}  ERROR ${f.error}`));
  if (maxed.length) parts.push("", "Still unpaid after every resend, chase personally:", ...maxed.map((i) => `#${i.doc}  ${i.customer}  ${money(i.balance)}  ${i.email || ""}`));
  const text = parts.join("\n");
  await sendViaResend({
    from: "Active 10 <notifications@getactive10.com>", replyTo: "activeformulations@gmail.com", to: SUMMARY_TO,
    subject: `Invoice chaser: ${sent.length} sent${failed.length ? `, ${failed.length} failed` : ""}`,
    text, html: `<pre style="font:13px ui-monospace,Menlo,monospace">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
  });
}

/** Called from the growth tick (every 10 min); runs at most once a day after run_after_minutes PT. */
export async function chaseIfDue(sb: SupabaseClient, pt: { date: string; minutes: number }) {
  const s = await loadChaserSettings(sb);
  if (!s.enabled || pt.minutes < s.run_after_minutes || (s.last_run_date && s.last_run_date >= pt.date)) return null;
  await sb.from("invoice_chaser_settings").update({ last_run_date: pt.date }).eq("id", "default");
  const r = await runChase(sb, { live: true });
  return { sent: r.sent.length, failed: r.failed.length };
}
