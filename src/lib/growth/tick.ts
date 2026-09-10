import { SupabaseClient } from "@supabase/supabase-js";
import { db, loadSettings, ptParts, isInternal, nextWeekday } from "./config";
import { getGmailAccess } from "@/lib/gmail";
import { sendMail, sentCount, threadHasMessageFrom } from "./gmailx";
import { scanInbox } from "./inbox";
import { planDay } from "./planner";
import { sendDigest } from "./digest";
import { discover } from "./discover";

/**
 * One heartbeat (pg_cron hits /api/growth/tick every 10 minutes):
 *   1. read the inbox — replies/bounces/"no thanks" cancel what's planned
 *   2. from 4pm PT: plan the NEXT weekday's batch and email the swipe link, so
 *      the deck can be swiped the evening before (6am same-day is the fallback)
 *   3. send whatever is due AND swiped right, two at most, each re-checked first
 *   4. spare time: find more chiropractors
 */
export async function tick() {
  const t0 = Date.now();
  const sb = db();
  const s = await loadSettings(sb);
  const pt = ptParts();
  const out: any = { pt };

  const token = await getGmailAccess();
  if (!token) {
    await sb.from("growth_settings").update({ last_error: "Gmail is disconnected. Reconnect at wholesale.getactive10.com → Admin → Outreach → Connect Gmail (sign in as activeformulations@gmail.com)." }).eq("id", "default");
    out.gmail = "disconnected";
  } else {
    if (s.last_error?.startsWith("Gmail")) await sb.from("growth_settings").update({ last_error: null }).eq("id", "default");
    try { out.inbox = await scanInbox(sb, token, s); } catch (e: any) { out.inbox = { error: e.message }; }
  }

  const weekday = pt.weekday !== "Sat" && pt.weekday !== "Sun";
  const target = pt.minutes >= 16 * 60 || !weekday ? nextWeekday(pt.date) : pt.date;
  if (s.enabled && (!s.last_plan_date || s.last_plan_date < target) && (pt.minutes >= 6 * 60 || !weekday)) {
    const plan = await planDay({ date: target });
    out.plan = { date: plan.date, skipped: plan.skipped, counts: plan.counts, pools: plan.pools, notes: plan.notes };
    if (!plan.skipped) {
      try { await sendDigest(sb, await loadSettings(sb), plan); } catch (e: any) { out.digestError = e.message; }
      return out; // planning used this tick's budget
    }
  }

  const live = s.enabled && (!s.start_date || pt.date >= s.start_date) && s.paused_on !== pt.date && weekday;
  out.live = live;
  if (live && token && pt.minutes >= s.window_start - 5 && pt.minutes <= s.window_end + 90) {
    out.sent = await sendDue(sb, token, 2, s.require_approval !== false);
  }

  if (Date.now() - t0 < 20000) {
    try { out.discover = await discover(sb, s, t0 + 45000); } catch (e: any) { out.discover = { error: e.message }; }
  }
  return out;
}

async function sendDue(sb: SupabaseClient, token: string, max: number, requireApproval: boolean) {
  let q = sb.from("growth_queue").select("*").eq("status", "planned").lte("send_at", new Date().toISOString());
  if (requireApproval) q = q.eq("approval", "approved"); // only what Darrin swiped right
  const { data: due } = await q.order("send_at").limit(max);
  const res: any[] = [];
  for (const row of due || []) {
    // Claim it first — a second overlapping tick then finds nothing to send.
    const { data: claimed } = await sb.from("growth_queue").update({ status: "sending" }).eq("id", row.id).eq("status", "planned").select("id");
    if (!claimed?.length) continue;
    const e = String(row.email).toLowerCase();
    const skip = async (reason: string) => {
      await sb.from("growth_queue").update({ status: "skipped", skip_reason: reason }).eq("id", row.id);
      res.push({ email: e, lane: row.lane, skipped: reason });
    };
    try {
      const { data: sup } = await sb.from("growth_suppression").select("email").eq("email", e).maybeSingle();
      if (sup || isInternal(e)) { await skip("suppressed"); continue; }
      const { data: ev } = await sb.from("growth_events").select("id").ilike("email", e).in("kind", ["reply", "unsubscribe", "bounce"]).gte("at", row.created_at).limit(1);
      if (ev?.length) { await skip("they wrote in"); continue; }

      // Gmail is the source of truth for what already went out.
      const threadId = row.meta?.threadId || null;
      if (threadId) {
        if (await threadHasMessageFrom(token, threadId, e)) { await skip("replied in the thread"); continue; }
      } else if (row.lane === "chiro" || row.lane === "club") {
        if (await sentCount(token, e, 90)) { await skip("already in Sent"); continue; }
      } else if (await sentCount(token, e, 14)) {
        await skip("emailed by hand in the last 2 weeks");
        continue;
      }

      const r = await sendMail(token, { to: row.email, subject: row.subject, text: row.body_text, html: row.body_html, threadId: row.meta?.newThread ? null : threadId, inReplyTo: row.meta?.inReplyTo || null });
      const now = new Date().toISOString();
      await sb.from("growth_queue").update({ status: "sent", sent_at: now, gmail_id: r.id, gmail_thread_id: r.threadId, message_id_header: r.messageId }).eq("id", row.id);
      await sb.from("growth_events").insert({ email: e, kind: "contacted", gmail_id: r.id, meta: { lane: row.lane } });

      // Keep the Outreach CRM in step so its reply tracking and counts stay true.
      if (row.prospect_id) {
        const { data: p } = await sb.from("outreach_prospects").select("id, touch_count").eq("id", row.prospect_id).maybeSingle();
        if (p) {
          const tc = (p.touch_count || 0) + 1;
          await sb.from("outreach_prospects").update({ status: tc > 1 ? "followed_up" : "emailed", touch_count: tc, last_contacted_at: now }).eq("id", p.id);
          await sb.from("outreach_touches").insert({ prospect_id: p.id, angle: row.lane, subject: row.subject, body: row.body_text, status: "sent", sent_at: now, channel: "email" });
        }
      }
      res.push({ email: e, lane: row.lane, sent: true });
    } catch (err: any) {
      await sb.from("growth_queue").update({ status: "failed", skip_reason: String(err?.message || err).slice(0, 300) }).eq("id", row.id);
      res.push({ email: e, lane: row.lane, error: String(err?.message || err) });
      if (/send (401|403)/.test(String(err?.message))) break;
    }
  }
  return res;
}
