import { SupabaseClient } from "@supabase/supabase-js";
import { SITE, LANE_LABEL, Lane, Settings, sign, deckKey, DEFAULT_CAPS } from "./config";
import { laneStats, learnedLines } from "./learning";
import { variantStats } from "./abtest";
import type { PlanResult } from "./planner";

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Sent when a batch is planned (4pm the day before). Leads with the swipe
 * link — nothing sends until Darrin swipes right — then who replied.
 */
export async function sendDigest(sb: SupabaseClient, s: Settings, plan: PlanResult) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const [{ data: sent }, { data: ev }] = await Promise.all([
    sb.from("growth_queue").select("email, name, business, lane, status, sent_at").eq("status", "sent").gte("sent_at", new Date(Date.now() - 45 * 86400000).toISOString()),
    sb.from("growth_events").select("email, kind, at, meta").gte("at", since).in("kind", ["reply", "bounce", "unsubscribe"]),
  ]);
  const mailed = new Map<string, any>();
  for (const r of sent || []) mailed.set(String(r.email).toLowerCase(), r);
  const recentSent = (sent || []).filter((r: any) => r.sent_at >= new Date(Date.now() - 86400000).toISOString()).length;
  const replies = (ev || []).filter((e: any) => e.kind === "reply" && mailed.has(e.email));
  const bounces = (ev || []).filter((e: any) => e.kind === "bounce").length;
  const unsubs = (ev || []).filter((e: any) => e.kind === "unsubscribe").length;

  const { data: tpls } = await sb.from("growth_templates").select("lane");
  const learned = learnedLines(await laneStats(sb), { ...DEFAULT_CAPS, ...(s.lane_caps || {}) } as Record<Lane, number>, (tpls || []).map((t: any) => t.lane));
  const learnedHtml = learned.length
    ? `<p style="margin:16px 0 6px"><b>What I've learned from your swipes:</b></p><ul style="margin:0;padding-left:18px">${learned.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
    : "";

  const deck = `${SITE}/swipe?k=${deckKey()}`;
  const abLink = `${SITE}/abtests?k=${deckKey()}`;
  const auto = new Set<string>(s.auto_lanes || ["chiro", "club", "cold_bump"]);
  const toSwipe = plan.rows.filter((r) => !auto.has(r.lane)).length;
  const autoCount = plan.rows.length - toSwipe;
  const vs = (await variantStats(sb)).filter((v) => v.status !== "retired");
  const board = vs.length
    ? `<p style="margin:16px 0 6px"><b>Cold letter A/B test</b> (<a href="${abLink}">see all</a>):</p><ul style="margin:0;padding-left:18px">${vs
        .map((v) => `<li>${esc(v.lane === "chiro" ? "Chiro" : "Club")} · ${esc(v.name)}: ${v.status === "proposed" ? "<b>new challenger waiting for your OK</b>" : `${v.replies}/${v.sent} replied${v.sent >= 20 ? `, ${Math.round(v.pBest * 100)}% chance best` : ""}`}</li>`)
        .join("")}</ul>`
    : "";
  const counts = Object.entries(plan.counts).map(([l, n]) => `${n} ${LANE_LABEL[l as Lane].toLowerCase()}`).join(" · ");
  const link = (a: string, d: string) => `${SITE}/api/growth/pause?a=${a}&d=${d}&s=${sign(`${a}:${d}`)}`;
  const warn = s.last_error ? `<p style="background:#fff3cd;padding:10px;border-radius:6px"><b>⚠️ ${esc(s.last_error)}</b></p>` : "";

  const replyHtml = replies.length
    ? `<p style="margin:16px 0 6px"><b>${replies.length} ${replies.length === 1 ? "person" : "people"} wrote back</b> (in your inbox; the engine stopped emailing them):</p><ul style="margin:0;padding-left:18px">${replies
        .map((e: any) => { const r = mailed.get(e.email); return `<li>${esc(r?.name || r?.business || e.email)} <span style="color:#888">(${esc(LANE_LABEL[r?.lane as Lane] || r?.lane)})</span>: “${esc(String(e.meta?.snippet || "").slice(0, 140))}”</li>`; })
        .join("")}</ul>`
    : "";

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px">
${warn}
<p style="font-size:16px;margin:0 0 12px"><b>${toSwipe} customer emails are waiting for your swipe for ${esc(dayLabel(plan.date))}.</b><br>${autoCount} cold emails will send on their own.<br><span style="color:#666">${esc(counts)}</span></p>
<p style="margin:0 0 14px"><a href="${deck}" style="display:inline-block;background:#0072BC;color:#fff;padding:14px 28px;border-radius:30px;text-decoration:none;font-weight:bold;font-size:16px">Swipe them →</a></p>
<p style="margin:0;color:#666">Right sends it, left skips it. Customer emails only go out once you swipe. Swipe before 8:30am and they go out spread across the day.</p>
${replyHtml}
${board}
${learnedHtml}
<p style="margin:16px 0 0;color:#888;font-size:12px">Last 24h: ${recentSent} sent · ${bounces} bounced · ${unsubs} opted out (3 days) · still queued behind this batch: ${plan.pools.winback ?? 0} lapsed customers, ${plan.pools.chiro ?? 0} chiropractors, ${plan.pools.club ?? 0} clubs.</p>
<p style="margin:8px 0 0;font-size:12px"><a href="${link("all", "x")}">Pause everything</a> · <a href="${link("resume", "x")}">Resume</a></p>
</div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Active 10 Growth <notifications@getactive10.com>",
      to: s.digest_to,
      subject: `Swipe ${toSwipe} Active 10 emails for ${dayLabel(plan.date)} (+${autoCount} cold auto)${replies.length ? ` · ${replies.length} replied` : ""}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} ${(await r.text()).slice(0, 160)}`);
}
