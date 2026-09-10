import { SupabaseClient } from "@supabase/supabase-js";
import { SITE, LANE_LABEL, Lane, Settings, sign, TZ } from "./config";
import type { PlanResult } from "./planner";

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/**
 * The morning email to Darrin. Results first (who replied — those are the
 * people he actually needs to answer), then what goes out today, then the
 * pause links. Nothing in it requires action.
 */
export async function sendDigest(sb: SupabaseClient, s: Settings, plan: PlanResult) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const lookback = new Date(plan.date + "T12:00:00Z").getUTCDay() === 1 ? 3 : 1; // Monday covers the weekend
  const since = new Date(Date.now() - lookback * 86400000).toISOString();
  const [{ data: sent }, { data: ev }] = await Promise.all([
    sb.from("growth_queue").select("email, name, business, lane, status, skip_reason, sent_at").gte("created_at", new Date(Date.now() - 45 * 86400000).toISOString()),
    sb.from("growth_events").select("email, kind, at, meta").gte("at", since).in("kind", ["reply", "bounce", "unsubscribe", "sample_shipped"]),
  ]);
  const mailed = new Map<string, any>();
  for (const r of sent || []) if (r.status === "sent") mailed.set(String(r.email).toLowerCase(), r);
  const recentSent = (sent || []).filter((r: any) => r.status === "sent" && r.sent_at >= since).length;
  const replies = (ev || []).filter((e: any) => e.kind === "reply" && mailed.has(e.email));
  const bounces = (ev || []).filter((e: any) => e.kind === "bounce").length;
  const unsubs = (ev || []).filter((e: any) => e.kind === "unsubscribe").length;

  const counts = Object.entries(plan.counts).map(([l, n]) => `${n} ${LANE_LABEL[l as Lane].toLowerCase()}`).join(" · ");
  const link = (a: string, d: string) => `${SITE}/api/growth/pause?a=${a}&d=${d}&s=${sign(`${a}:${d}`)}`;

  const replyHtml = replies.length
    ? `<p style="margin:0 0 6px"><b>${replies.length} ${replies.length === 1 ? "person" : "people"} wrote back</b> — they're in your inbox, and the engine has stopped emailing them:</p><ul style="margin:0 0 16px;padding-left:18px">${replies
        .map((e: any) => { const r = mailed.get(e.email); return `<li>${esc(r?.name || r?.business || e.email)} <span style="color:#888">(${esc(LANE_LABEL[r?.lane as Lane] || r?.lane)})</span> — “${esc(String(e.meta?.snippet || "").slice(0, 140))}”</li>`; })
        .join("")}</ul>`
    : `<p style="margin:0 0 16px;color:#666">No replies from engine emails ${lookback === 3 ? "since Friday" : "yesterday"}.</p>`;

  const warn = s.last_error ? `<p style="background:#fff3cd;padding:10px;border-radius:6px"><b>⚠️ ${esc(s.last_error)}</b></p>` : "";

  const rows = plan.rows.map((r) =>
    `<tr><td style="padding:4px 8px;color:#666;white-space:nowrap">${time(r.send_at)}</td><td style="padding:4px 8px;white-space:nowrap">${esc(LANE_LABEL[r.lane])}</td><td style="padding:4px 8px">${esc(r.name || r.business || r.email)}<br><span style="color:#888;font-size:12px">${esc(r.email)}</span></td><td style="padding:4px 8px">${esc(r.subject)}</td></tr>`).join("");

  const runway = `Still queued up behind today: ${plan.pools.winback ?? 0} lapsed customers, ${plan.pools.restock ?? 0} due to restock, ${plan.pools.chiro ?? 0} chiropractors, ${plan.pools.club ?? 0} clubs.`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:720px">
${warn}
<p style="margin:0 0 4px;color:#666">${lookback === 3 ? "Since Friday" : "Yesterday"}: ${recentSent} sent · ${replies.length} replies · ${bounces} bounced · ${unsubs} opted out</p>
${replyHtml}
<p style="margin:0 0 6px"><b>Going out today (${plan.rows.length}):</b> ${esc(counts)}</p>
<table style="border-collapse:collapse;font-size:13px;margin-bottom:12px">${rows}</table>
<p style="color:#666;font-size:12px">${esc(runway)}</p>
<p style="margin:16px 0">Nothing to do — it sends itself from activeformulations@gmail.com. If you need to stop it:
<a href="${link("today", plan.date)}">Pause today</a> · <a href="${link("all", "x")}">Pause everything</a> · <a href="${link("resume", "x")}">Resume</a></p>
</div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Active 10 Growth <notifications@getactive10.com>",
      to: s.digest_to,
      subject: `Active 10: ${plan.rows.length} emails today${replies.length ? ` · ${replies.length} replied` : ""}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} ${(await r.text()).slice(0, 160)}`);
}
