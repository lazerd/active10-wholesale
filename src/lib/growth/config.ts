import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const SITE = "https://wholesale.getactive10.com";
export const TZ = "America/Los_Angeles";
export const DAY_MS = 86400000;

export const db = (): SupabaseClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/**
 * Lanes, in fill order. Customer lanes go first because they are where the
 * orders actually came from (the July FIREWORKS mailing to existing accounts
 * produced every order this summer; the cold chiro letter replies ~4%).
 */
export type Lane = "sample_followup" | "restock" | "winback_bump" | "cold_bump" | "winback" | "chiro" | "club";
export const LANE_ORDER: Lane[] = ["sample_followup", "restock", "winback_bump", "cold_bump", "winback", "chiro", "club"];
export const LANE_LABEL: Record<Lane, string> = {
  sample_followup: "Sample follow-up",
  restock: "Restock check-in",
  winback_bump: "Win-back nudge",
  cold_bump: "Cold follow-up",
  winback: "Win-back (15% off)",
  chiro: "Cold chiro letter",
  club: "Cold club letter",
};
/** Per-lane daily ceilings. Unused slots overflow to OVERFLOW_ORDER. */
export const DEFAULT_CAPS: Record<Lane, number> = {
  sample_followup: 3, restock: 5, winback_bump: 4, cold_bump: 6, winback: 10, chiro: 8, club: 2,
};
export const OVERFLOW_ORDER: Lane[] = ["winback", "chiro", "club"];

export type Settings = {
  id: string; enabled: boolean; daily_cap: number; lane_caps: Partial<Record<Lane, number>>;
  start_date: string | null; paused_on: string | null; window_start: number; window_end: number;
  footer_address: string | null; digest_to: string; city_cursor: number;
  last_plan_date: string | null; last_inbox_scan: string | null; last_error: string | null;
  require_approval: boolean;
};

/** The next Monday–Friday after `date` (YYYY-MM-DD). */
export function nextWeekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export async function loadSettings(sb: SupabaseClient): Promise<Settings> {
  const { data, error } = await sb.from("growth_settings").select("*").eq("id", "default").single();
  if (error || !data) throw new Error("growth_settings missing: " + (error?.message || "no row"));
  return data as Settings;
}

/** Supabase caps a select at 1000 rows; page through everything. */
export async function fetchAll<T = any>(make: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ── time (everything is planned in Pacific wall-clock) ──────────────────────
export function ptParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p: Record<string, string> = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: p.weekday };
}

/** PT wall-clock (YYYY-MM-DD + minutes after midnight) → UTC instant. */
export function ptToUtc(date: string, minutes: number): Date {
  const noon = new Date(`${date}T20:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(noon).find((p) => p.type === "timeZoneName")?.value || "GMT-8";
  const off = Number(name.replace("GMT", "") || -8);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60) - off, minutes % 60));
}

export const isWeekendDate = (date: string) => {
  const wd = new Date(`${date}T20:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
};

// ── people ──────────────────────────────────────────────────────────────────
export const FREE_MAIL = new Set([
  "gmail.com", "yahoo.com", "aol.com", "hotmail.com", "outlook.com", "icloud.com", "me.com", "mac.com", "msn.com",
  "comcast.net", "att.net", "earthlink.net", "sbcglobal.net", "verizon.net", "live.com", "protonmail.com", "proton.me",
  "cox.net", "bellsouth.net", "charter.net", "googlemail.com", "ymail.com", "rocketmail.com",
]);

/** Never mailed by the engine: us, June, the orders inbox. */
export const isInternal = (email: string) =>
  /(^darrin|junemunroe|activeformulation|@active10\.net$|@getactive10\.com$|@anthropic\.com$)/i.test(email);

export const firstEmail = (s?: string | null) =>
  ((s || "").match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [""])[0].toLowerCase();

const BIZ = /chiro|clinic|center|centre|wellness|health|spine|sport|therap|rehab|physical|massage|spa\b|studio|gym|fitness|club|tennis|golf|\binc\b|llc|corp|company|\bco\b|group|associates|practice|medical|care|pharm|store|shop|market|team|universit|athletic|academy|school|hospital|institute|&|\bpt\b|yoga|pilates|crossfit|family|office/i;

function tidy(w: string) {
  if (!w) return w;
  if (w === w.toUpperCase() || w === w.toLowerCase()) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * The first line of the email. A real surname when the record clearly has one,
 * otherwise the business ("Hi Carson Chiropractic team,"). Never a guessed name —
 * getting a doctor's name wrong is worse than not using it.
 */
export function greetingFor(display?: string | null, given?: string | null, family?: string | null, company?: string | null): string {
  const d = (display || "").replace(/\s+/g, " ").trim();
  if (/^dr\.?\s/i.test(d)) {
    if (family && !BIZ.test(family)) return `Dr. ${tidy(family)},`;
    const rest = d.replace(/^dr\.?\s+/i, "").replace(/,?\s*\b(d\.?c|m\.?d|dpt|pt|l\.?ac|dacbsp|ccsp)\.?\s*$/i, "").trim();
    const toks = rest.split(" ").filter(Boolean);
    if (toks.length >= 1 && toks.length <= 3 && !BIZ.test(rest) && toks.every((t) => /^[A-Za-z'.-]+$/.test(t))) return `Dr. ${tidy(toks[toks.length - 1])},`;
  }
  if (given && !BIZ.test(given) && /^[A-Za-z'.-]{2,}$/.test(given.trim())) return `Hi ${tidy(given.trim())},`;
  if (d && !BIZ.test(d)) {
    const toks = d.split(" ");
    if (toks.length >= 2 && toks.length <= 3 && toks.every((t) => /^[A-Za-z'.-]+$/.test(t)) && toks[0].length > 1) return `Hi ${tidy(toks[0])},`;
  }
  let biz = (company || d).replace(/\s+/g, " ").trim();
  if (biz === biz.toUpperCase()) biz = biz.split(" ").map(tidy).join(" "); // "BODY RESTORATIVE CLINIC"
  if (biz && biz.length <= 60) return `Hi ${biz.replace(/\s+team$/i, "")} team,`;
  return "Hello,";
}

/**
 * The first nine chiro letters (9/8) left with a double-encoded em dash —
 * "Active 10 Ã¢Â€Â” samples for …". Put the dash back.
 */
export const fixMojibake = (s: string) => s.replace(/ (?=\S*[ÃÂ])\S{2,14} /g, " — ");

/**
 * Wholesale accounts only. Retail getactive10.com shoppers live in QuickBooks
 * too (some with 20+ orders) but a "reply and I'll invoice you" letter is the
 * wrong offer for them — they get a retail lane once there's a retail code.
 */
export const looksWholesale = (c: { spent: number; company: string | null; display: string; retail?: boolean }) =>
  !c.retail && (c.spent >= 150 || !!c.company || /^dr\.?\s|\bd\.?c\.?\b|chiro|clinic|therap|wellness|spine|rehab|club|tennis|gym|fitness|studio|sport|massage|medical|health/i.test(c.display));

/** Short name for bumps: "Dr. Smith" / "Jen" / "Carson Chiropractic team". */
export const shortGreeting = (greeting: string) => greeting.replace(/^Hi\s+/, "").replace(/,$/, "");

// ── rendering ───────────────────────────────────────────────────────────────
export function withFooter(text: string, address: string | null) {
  const lines = ["--"];
  if (address) lines.push(address);
  lines.push(`If you'd rather not get these, reply "no thanks" and I won't write again.`);
  return `${text}\n\n${lines.join("\n")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain letter → minimal HTML. The portal domain becomes a real link. */
export function toHtml(text: string) {
  const body = esc(text)
    .replace(/(https?:\/\/)?(wholesale\.getactive10\.com(\/[^\s<),]*)?)/g, (_m, _p, host) => `<a href="https://${host}">${host}</a>`)
    .replace(/\n/g, "<br>");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${body}</div>`;
}

// ── signed links in the digest (pause/resume without logging in) ────────────
export function sign(payload: string) {
  return crypto.createHmac("sha256", process.env.GROWTH_SECRET || "unset").update(payload).digest("hex").slice(0, 24);
}

/** The key in Darrin's /swipe link. Rotating GROWTH_SECRET rotates it. */
export const deckKey = () => sign("deck:v1");

export const monthYear = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
export const monthDay = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
