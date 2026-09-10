import { SupabaseClient } from "@supabase/supabase-js";
import { Settings } from "./config";
import { listIds, getMeta, getText, addrOf, threadAddresses } from "./gmailx";

/**
 * Reads the activeformulations@ inbox since the last tick and turns it into
 * events. The rule the whole engine hangs on: the moment a person writes to us
 * — anything at all — every planned email to them is cancelled and they are
 * left out of automated mail for 60 days. Darrin is in a conversation with
 * them now; a robot must not talk over him.
 */
const OURS = /activeformulation|junemunroe|darrinjco|@getactive10\.com|@active10\.net/i;
const AUTOMATED = /mailer-daemon|postmaster|no-?reply|donotreply|notifications?@|notify@|bounces?@|@shopify|@google\.com|@quickbooks|@intuit|@vercel|@github|@stripe|@squareup|@paypal|@amazon|@ups\.com|@fedex|@usps|@explee|@kurvpay|@resend/i;
const UNSUB = /\b(unsubscribe|remove me|take me off|no thanks|no thank you|not interested|stop (emailing|sending|contacting)|do not (email|contact)|please stop)\b/i;
const BOUNCE_SUBJ = /delivery status notification|undeliverable|undelivered mail|mail delivery (failed|subsystem)|returned mail|delivery (has )?failed|failure notice|address not found/i;
const SAMPLE_THREAD = /samples? for|free sample|fellow dca|pro shop|did the samples/i;

/** Only the words they typed — drop the quoted original (which contains our own "no thanks" footer). */
const ownWords = (snippet: string) => snippet.split(/\bOn [^\n]{0,90}wrote:|-----Original Message-----|From: /i)[0];

async function event(sb: SupabaseClient, email: string, kind: string, gmailId: string | null, meta: any = {}) {
  await sb.from("growth_events").insert({ email: email.toLowerCase(), kind, gmail_id: gmailId, meta }); // unique (gmail_id, kind) makes re-runs no-ops
}
async function suppress(sb: SupabaseClient, email: string, reason: string) {
  await sb.from("growth_suppression").upsert({ email: email.toLowerCase(), reason }, { onConflict: "email", ignoreDuplicates: true });
}
async function cancelPlanned(sb: SupabaseClient, email: string, reason: string): Promise<number> {
  const { data } = await sb.from("growth_queue").update({ status: "cancelled", skip_reason: reason }).ilike("email", email).eq("status", "planned").select("id");
  return data?.length || 0;
}

export async function scanInbox(sb: SupabaseClient, token: string, s: Settings) {
  const startedAt = new Date().toISOString();
  const since = s.last_inbox_scan ? Math.floor(Date.parse(s.last_inbox_scan) / 1000) - 900 : Math.floor(Date.now() / 1000) - 2 * 86400;
  const res = { checked: 0, replies: 0, bounces: 0, unsubscribes: 0, samples: 0, cancelled: 0 };

  const ids = await listIds(token, `after:${since} -in:sent -in:chats -in:drafts`, 60);
  const { data: done } = ids.length ? await sb.from("growth_events").select("gmail_id").in("gmail_id", ids) : { data: [] as any[] };
  const seen = new Set((done || []).map((d: any) => d.gmail_id));

  for (const id of ids) {
    if (seen.has(id)) continue;
    res.checked++;
    const m = await getMeta(token, id);
    const from = addrOf(m.h.from || "");
    const subj = m.h.subject || "";
    if (!from || OURS.test(from)) continue;

    // Bounces: suppress the address we tried, forever.
    if (/mailer-daemon|postmaster/i.test(from) || BOUNCE_SUBJ.test(subj)) {
      const text = await getText(token, id).catch(() => m.snippet);
      const cands = Array.from(new Set((text.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map((x) => x.toLowerCase())))
        .filter((x) => !OURS.test(x) && !/mailer-daemon|postmaster|google|gmail-smtp/i.test(x));
      for (const e of cands) {
        const [{ data: q }, { data: p }] = await Promise.all([
          sb.from("growth_queue").select("id").ilike("email", e).eq("status", "sent").limit(1),
          sb.from("outreach_prospects").select("id").ilike("email", e).limit(1),
        ]);
        if (!q?.length && !p?.length) continue;
        await suppress(sb, e, "bounced");
        await sb.from("outreach_prospects").update({ status: "dead" }).ilike("email", e);
        await event(sb, e, "bounce", id, { subject: subj });
        res.bounces++;
        res.cancelled += await cancelPlanned(sb, e, "bounced");
      }
      continue;
    }
    if (AUTOMATED.test(from)) continue;

    // A human wrote in.
    const words = ownWords(m.snippet);
    await event(sb, from, "reply", id, { subject: subj, snippet: words.slice(0, 240) });
    res.replies++;
    res.cancelled += await cancelPlanned(sb, from, "they wrote in");
    await sb.from("outreach_prospects").update({ status: "replied" }).ilike("email", from).in("status", ["prospected", "emailed", "followed_up"]);
    if (UNSUB.test(words) || UNSUB.test(subj.replace(/^re:\s*/i, ""))) {
      await suppress(sb, from, "asked to stop");
      await event(sb, from, "unsubscribe", id, { snippet: words.slice(0, 240) });
      res.unsubscribes++;
    }
  }

  // Samples: Darrin forwards a sample request to the orders inbox (that is how
  // it gets packed). Log it so the "did the samples make it?" follow-up fires.
  const fwd = await listIds(token, `after:${since} in:sent to:activeformulationorders@gmail.com`, 20);
  for (const id of fwd) {
    const m = await getMeta(token, id);
    if (!/^fwd?:/i.test(m.h.subject || "") || !SAMPLE_THREAD.test(m.h.subject || "")) continue;
    const people = (await threadAddresses(token, m.threadId)).filter((a) => !OURS.test(a) && !AUTOMATED.test(a));
    for (const e of people) {
      const { data: have } = await sb.from("sample_requests").select("id").ilike("email", e).limit(1);
      if (have?.length) continue;
      const { data: p } = await sb.from("outreach_prospects").select("id, name, business, type").ilike("email", e).limit(1).maybeSingle();
      const { error } = await sb.from("sample_requests").insert({
        name: p?.name || p?.business || e, business: p?.business || null, email: e, type: p?.type || "chiropractor",
        status: "shipped", shipped_at: m.at, notes: "auto-logged: sample request forwarded to orders", prospect_id: p?.id || null,
      });
      if (!error) { await event(sb, e, "sample_shipped", id); res.samples++; }
    }
  }

  await sb.from("growth_settings").update({ last_inbox_scan: startedAt, updated_at: startedAt }).eq("id", "default");
  return res;
}
