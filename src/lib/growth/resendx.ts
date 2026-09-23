import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Cold letters sent through Resend from outreach.getactive10.com, so a spam
 * complaint can't touch the activeformulations@gmail.com inbox. Replies go to
 * Gmail (Reply-To), where scanInbox already picks them up.
 */
export async function sendViaResend(opts: {
  from: string; replyTo: string; to: string; subject: string; text: string; html: string; inReplyTo?: string | null;
}): Promise<{ id: string; messageId: string }> {
  const domain = (opts.from.match(/@([^>\s]+)/) || [])[1] || "outreach.getactive10.com";
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const headers: Record<string, string> = { "Message-ID": messageId };
  if (opts.inReplyTo) { headers["In-Reply-To"] = opts.inReplyTo; headers["References"] = opts.inReplyTo; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: opts.from, to: opts.to, reply_to: opts.replyTo, subject: opts.subject, text: opts.text, html: opts.html, headers }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`resend send ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return { id: j.id, messageId };
}

/** Resend bounces never reach Gmail, so ask Resend how recent cold letters landed. */
export async function checkResendBounces(sb: SupabaseClient, max = 15): Promise<{ checked: number; bounced: string[] }> {
  const since = new Date(Date.now() - 6 * 86400000).toISOString();
  const { data: rows } = await sb.from("growth_queue").select("id, email, gmail_id, meta")
    .eq("status", "sent").gte("sent_at", since).eq("meta->>via", "resend").is("meta->>delivery", null).order("sent_at").limit(max);
  const out = { checked: 0, bounced: [] as string[] };
  for (const row of rows || []) {
    const r = await fetch(`https://api.resend.com/emails/${row.gmail_id}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: "no-store" });
    if (!r.ok) continue;
    const ev = String((await r.json()).last_event || "");
    out.checked++;
    if (!["bounced", "delivered", "complained"].includes(ev)) continue; // still in flight
    await sb.from("growth_queue").update({ meta: { ...row.meta, delivery: ev } }).eq("id", row.id);
    if (ev === "delivered") continue;
    const e = String(row.email).toLowerCase();
    await sb.from("growth_suppression").upsert({ email: e, reason: ev === "complained" ? "marked as spam" : "bounced" });
    await sb.from("growth_events").insert({ email: e, kind: ev === "complained" ? "unsubscribe" : "bounce", meta: { via: "resend" } });
    await sb.from("outreach_prospects").update({ status: "dead" }).ilike("email", e);
    out.bounced.push(e);
  }
  return out;
}
