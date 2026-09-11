import { SupabaseClient } from "@supabase/supabase-js";
import { LANE_LABEL, LANE_ORDER, Lane, fetchAll } from "./config";

/**
 * What the swipes teach the engine (v1):
 *   1. volume  — lanes Darrin keeps swiping right get more daily slots, lanes
 *                he keeps skipping get fewer (never zero: it keeps sampling)
 *   2. results — a lane with 20+ sends and no replies is halved
 *   3. wording — his own rewrite of a lane becomes that lane's template
 */
export type LaneStat = { lane: Lane; approved: number; rejected: number; edited: number; sent: number; replies: number; reasons: Record<string, number> };
export type Vars = Record<string, string | null | undefined>;

export async function laneStats(sb: SupabaseClient): Promise<Record<string, LaneStat>> {
  const since = new Date(Date.now() - 45 * 86400000).toISOString();
  const [rows, replies] = await Promise.all([
    fetchAll<any>(() => sb.from("growth_queue").select("lane, email, approval, status, reject_reason, meta").gte("created_at", since)),
    fetchAll<any>(() => sb.from("growth_events").select("email").eq("kind", "reply").gte("at", since)),
  ]);
  const replied = new Set(replies.map((r) => String(r.email).toLowerCase()));
  const out: Record<string, LaneStat> = {};
  for (const r of rows) {
    const s = (out[r.lane] ||= { lane: r.lane, approved: 0, rejected: 0, edited: 0, sent: 0, replies: 0, reasons: {} });
    if (r.approval === "approved") s.approved++;
    if (r.approval === "rejected") {
      s.rejected++;
      if (r.reject_reason) s.reasons[r.reject_reason] = (s.reasons[r.reject_reason] || 0) + 1;
    }
    if (r.meta?.edited) s.edited++;
    if (r.status === "sent") { s.sent++; if (replied.has(String(r.email).toLowerCase())) s.replies++; }
  }
  return out;
}

/** 1.3× for lanes he loves, down to 0.3× for lanes he skips. Needs 5 decisions before it moves. */
export function multiplier(s?: LaneStat): number {
  if (!s) return 1;
  const n = s.approved + s.rejected;
  let m = 1;
  if (n >= 5) {
    const rate = (s.approved + 2) / (n + 3); // small prior so one bad day doesn't swing it
    m = rate >= 0.8 ? 1.3 : rate >= 0.6 ? 1 : rate >= 0.4 ? 0.6 : 0.3;
  }
  if (s.sent >= 20 && s.replies === 0) m *= 0.5;
  return m;
}

export function adaptCaps(base: Record<Lane, number>, stats: Record<string, LaneStat>): Record<Lane, number> {
  const out = { ...base };
  for (const l of LANE_ORDER) out[l] = Math.max(1, Math.round(base[l] * multiplier(stats[l])));
  return out;
}

const REASON_LABEL: Record<string, string> = {
  wrong_person: "wrong person", greeting: "bad greeting", offer: "wrong offer", voice: "doesn't sound like you", timing: "not now",
};

/** Plain-English "here's what I've picked up" lines for the deck and digest. */
export function learnedLines(stats: Record<string, LaneStat>, base: Record<Lane, number>, templated: string[] = []): string[] {
  const lines: string[] = [];
  for (const l of LANE_ORDER) {
    const s = stats[l];
    if (!s) continue;
    const n = s.approved + s.rejected;
    if (n >= 5) {
      const m = multiplier(s);
      const cap = Math.max(1, Math.round(base[l] * m));
      const top = Object.entries(s.reasons).sort((a, b) => b[1] - a[1])[0];
      let line = `${LANE_LABEL[l]}: you sent ${s.approved} of ${n}`;
      if (m > 1) line += ` → sending more (${cap}/day)`;
      else if (m < 1) line += ` → sending fewer (${cap}/day)`;
      if (top && s.rejected >= 2) line += `. Most skips: ${REASON_LABEL[top[0]] || top[0]}`;
      lines.push(line + ".");
    }
    if (s.sent >= 20 && s.replies === 0) lines.push(`${LANE_LABEL[l]}: ${s.sent} sent, no replies yet → cut back.`);
  }
  for (const l of templated) lines.push(`${LANE_LABEL[l as Lane] || l}: using your rewrite as the template.`);
  return lines;
}

/**
 * Turn one rewritten email into a template: the recipient's specifics (their
 * greeting, business, last order date…) become {{placeholders}}. Longest
 * values first so "Arena Chiropractic team" wins over "Arena Chiropractic".
 */
export function generalize(subject: string, text: string, vars: Vars) {
  let s = subject, t = text;
  const pairs = Object.entries(vars).filter(([, v]) => v && String(v).trim().length >= 3).sort((a, b) => String(b[1]).length - String(a[1]).length);
  for (const [k, v] of pairs) {
    s = s.split(String(v)).join(`{{${k}}}`);
    t = t.split(String(v)).join(`{{${k}}}`);
  }
  return { subject: s, body: t };
}

/** Fill a template for one person. null if any placeholder has no value — the built-in email is used instead. */
export function renderTemplate(tpl: { subject: string; body: string }, vars: Vars): { subject: string; text: string } | null {
  let missing = false;
  const fill = (x: string) => x.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
    const v = vars[k];
    if (v === null || v === undefined || v === "") { missing = true; return ""; }
    return String(v);
  });
  const subject = fill(tpl.subject), text = fill(tpl.body);
  return missing ? null : { subject, text };
}
