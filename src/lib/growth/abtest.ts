import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll, ptParts } from "./config";

/**
 * Daily A/B testing for the cold letters.
 *
 * Each active variant gets sends until it has MIN_TRIAL of them (a plain split).
 * After that, volume follows Thompson sampling on the reply rate: every pick
 * draws from each variant's Beta(1 + replies, 1 + misses) and the highest draw
 * wins, so a letter that's earning replies gets most of the day while the others
 * keep a small share and can still catch up. A variant that has had its chance
 * (RETIRE_AFTER sends) and has under a 5% chance of being the best is retired.
 */
export const MIN_TRIAL = 20;
export const RETIRE_AFTER = 60;

export type Variant = {
  id: string; lane: string; name: string; angle: string | null; subject: string | null; body: string | null;
  status: string; source: string; created_at: string;
};
export type VariantStat = Variant & { sent: number; replies: number; noThanks: number; pBest: number };

// ── Beta sampling (Marsaglia–Tsang gamma) ───────────────────────────────────
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gamma(k: number): number {
  if (k < 1) return gamma(k + 1) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gauss(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
const beta = (a: number, b: number) => { const x = gamma(a); return x / (x + gamma(b)); };
const draw = (s: { sent: number; replies: number }) => beta(1 + s.replies, 1 + Math.max(0, s.sent - s.replies));

/** Sends, replies and "no thanks" per variant, attributed to replies that came after the send. */
export async function variantStats(sb: SupabaseClient, lane?: string): Promise<VariantStat[]> {
  let vq = sb.from("growth_variants").select("*").in("status", ["active", "proposed", "retired"]);
  if (lane) vq = vq.eq("lane", lane);
  const { data: variants } = await vq.order("created_at");
  const sent = await fetchAll<any>(() => sb.from("growth_queue").select("variant_id, email, sent_at").eq("status", "sent").not("variant_id", "is", null));
  const events = await fetchAll<any>(() => sb.from("growth_events").select("email, kind, at").in("kind", ["reply", "unsubscribe"]));
  const firstEvent = new Map<string, { reply?: number; unsub?: number }>();
  for (const e of events) {
    const k = String(e.email).toLowerCase(), t = Date.parse(e.at);
    const m = firstEvent.get(k) || {};
    if (e.kind === "reply") m.reply = Math.min(m.reply ?? Infinity, t); else m.unsub = Math.min(m.unsub ?? Infinity, t);
    firstEvent.set(k, m);
  }
  const out = new Map<string, VariantStat>();
  for (const v of variants || []) out.set(v.id, { ...v, sent: 0, replies: 0, noThanks: 0, pBest: 0 });
  for (const r of sent) {
    const s = out.get(r.variant_id);
    if (!s) continue;
    s.sent++;
    const ev = firstEvent.get(String(r.email).toLowerCase());
    const at = Date.parse(r.sent_at);
    if (ev?.unsub && ev.unsub >= at) s.noThanks++;
    else if (ev?.reply && ev.reply >= at) s.replies++;
  }
  // Chance each active variant is the best, per lane (2,000 simulated draws).
  const list = Array.from(out.values());
  for (const l of Array.from(new Set(list.map((v) => v.lane)))) {
    const act = list.filter((v) => v.lane === l && v.status === "active");
    if (!act.length) continue;
    const wins = new Array(act.length).fill(0);
    for (let i = 0; i < 2000; i++) {
      let best = 0, bv = -1;
      act.forEach((v, j) => { const x = draw(v); if (x > bv) { bv = x; best = j; } });
      wins[best]++;
    }
    act.forEach((v, j) => (v.pBest = wins[j] / 2000));
  }
  return list;
}

/** Hands out variants for one planning day, keeping the split fair within the day. */
export function makePicker(stats: VariantStat[]) {
  const live = stats.filter((v) => v.status === "active");
  const today = new Map<string, number>(); // picks already made this plan
  return (lane: string): VariantStat | null => {
    const pool = live.filter((v) => v.lane === lane);
    if (!pool.length) return null;
    const n = (v: VariantStat) => v.sent + (today.get(v.id) || 0);
    // Still in the trial phase: least-sent first, so every version gets a fair start.
    const trial = pool.filter((v) => n(v) < MIN_TRIAL);
    let pick: VariantStat;
    if (trial.length) pick = trial.sort((a, b) => n(a) - n(b) || Math.random() - 0.5)[0];
    else {
      let best = -1;
      pick = pool[0];
      for (const v of pool) { const x = draw(v); if (x > best) { best = x; pick = v; } }
    }
    today.set(pick.id, (today.get(pick.id) || 0) + 1);
    return pick;
  };
}

/** Fills a variant's {placeholders}. Returns null if a needed value is missing. */
export function renderVariant(v: Variant, vars: Record<string, string | null | undefined>): { subject: string; text: string } | null {
  if (!v.subject || !v.body) return null;
  let missing = false;
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_m, k) => { const x = vars[k]; if (!x) missing = true; return x || ""; });
  const subject = fill(v.subject), text = fill(v.body);
  return missing ? null : { subject, text };
}

/** Warmup: 5 cold letters a day the first week, then 10, 15, 20, 25. */
export function coldBudget(s: { cold_start_date?: string | null; cold_ramp?: number[] | null }, date: string) {
  const ramp = s.cold_ramp?.length ? s.cold_ramp : [5, 10, 15, 20, 25];
  if (!s.cold_start_date) return ramp[0];
  const weeks = Math.floor((Date.parse(date) - Date.parse(s.cold_start_date)) / (7 * 86400000));
  return ramp[Math.max(0, Math.min(ramp.length - 1, weeks))];
}

/** Retires variants that have had their chance and are very unlikely to be best. */
export async function retireLosers(sb: SupabaseClient): Promise<string[]> {
  const stats = await variantStats(sb);
  const out: string[] = [];
  for (const lane of Array.from(new Set(stats.map((v) => v.lane)))) {
    const act = stats.filter((v) => v.lane === lane && v.status === "active");
    if (act.length < 2) continue;
    for (const v of act) {
      if (v.sent >= RETIRE_AFTER && v.pBest < 0.05 && act.filter((a) => a.status === "active").length > 1) {
        await sb.from("growth_variants").update({ status: "retired", decided_at: new Date().toISOString(), notes: `Retired ${ptParts().date}: ${v.replies}/${v.sent} replies, ${(v.pBest * 100).toFixed(1)}% chance of being best` }).eq("id", v.id);
        v.status = "retired";
        out.push(`${lane}: retired ${v.name}`);
      }
    }
  }
  return out;
}

const STYLE = `Write like Darrin, a real founder emailing one person. Plain words, contractions, short. No em dashes or en dashes. No lists, no bold, no "no catch", no "I hope this finds you well", no hype words, no rhetorical triads. Only these facts may appear: Active 10 is a topical pain relief cream Darrin makes; chiropractors were the first customers and many practices sell it at the front desk; free samples by mail; starter kit is 3 tubes, 3 roll-ons and 10 sample packets for $99 shipped (about $240 retail); accounts at wholesale.getactive10.com; for clubs, sore players buy it at the pro shop counter and Darrin is a fellow tennis director. Keep {greeting} as the first line and {business} only in the subject if used.`;

/**
 * Once a week per lane, drafts ONE new challenger from what's winning and losing.
 * It lands as 'proposed' and only joins the test after Darrin approves it.
 */
export async function proposeChallengers(sb: SupabaseClient, gemini: (prompt: string) => Promise<any>): Promise<string[]> {
  const stats = await variantStats(sb);
  const out: string[] = [];
  for (const lane of ["chiro", "club"]) {
    const lv = stats.filter((v) => v.lane === lane);
    if (lv.some((v) => v.status === "proposed")) continue;              // one waiting at a time
    const act = lv.filter((v) => v.status === "active");
    if (act.reduce((n, v) => n + v.sent, 0) < 40) continue;           // not enough data yet
    const ranked = [...lv].sort((a, b) => b.replies / Math.max(1, b.sent) - a.replies / Math.max(1, a.sent));
    const show = (v: VariantStat) => `"${v.name}" (${v.replies} replies / ${v.sent} sent): angle: ${v.angle}\nSUBJECT: ${v.subject || "(built-in)"}\n${v.body || "(built-in long founder letter)"}`;
    const res = await gemini(`We're A/B testing cold emails for Active 10 to ${lane === "chiro" ? "chiropractors" : "tennis club pro shops"}. Results so far, best first:\n\n${ranked.map(show).join("\n\n---\n\n")}\n\nWrite ONE new challenger that tries a genuinely different angle from all of the above (not a rewording), informed by what's winning. ${STYLE} 40 to 110 words, ending with "Thanks," and the same signature lines the others use.\nReturn JSON {"name":"E · <2-4 word angle>","angle":"one line","subject":"...","body":"..."}`);
    if (!res?.subject || !res?.body || /[—–]/.test(res.body + res.subject)) continue;
    await sb.from("growth_variants").insert({ lane, name: String(res.name).slice(0, 60), angle: res.angle, subject: res.subject, body: res.body, status: "proposed", source: "ai" });
    out.push(`${lane}: proposed "${res.name}"`);
  }
  return out;
}
