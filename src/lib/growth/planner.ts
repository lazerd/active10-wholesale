import {
  db, loadSettings, fetchAll, ptParts, ptToUtc, isWeekendDate, isInternal, greetingFor, withFooter, toHtml,
  FREE_MAIL, DAY_MS, LANE_ORDER, OVERFLOW_ORDER, DEFAULT_CAPS, Lane, fixMojibake, looksWholesale, shortGreeting, monthDay, monthYear,
} from "./config";
import { laneStats, adaptCaps, multiplier, renderTemplate, Vars } from "./learning";
import { loadQbContacts, lastOrderSummary, Contact } from "./qb";
import * as T from "./templates";
import { getGmailAccess } from "@/lib/gmail";
import { latestSentTo, threadHasMessageFrom } from "./gmailx";

export type PlanRow = {
  plan_date: string; send_at: string; lane: Lane; step: number; email: string; name: string | null; business: string | null;
  subject: string; body_text: string; body_html: string; dedupe_key: string; reply_to_queue_id: string | null;
  prospect_id: string | null; qb_customer_id: string | null; meta: any;
};
type Cand = Omit<PlanRow, "plan_date" | "send_at" | "body_text" | "body_html"> & { text: string };
type Pre = { email: string; quiet: number; used?: boolean; build: () => Promise<Cand | null> };

export type PlanResult = {
  date: string; skipped?: string; rows: PlanRow[]; counts: Record<string, number>; pools: Record<string, number>; notes: string[];
};

/** Accounts this size are Darrin's personal relationships — never automated. */
const HOUSE_ACCOUNT = 10000;
const lower = (s?: string | null) => (s || "").trim().toLowerCase();
const domainOf = (e: string) => e.split("@")[1] || "";
/** A real practice name, not a domain or a page title ("X | Walk-In Care Near You"). */
const cleanBusiness = (b?: string | null) => {
  const s = (b || "").replace(/\s+/g, " ").trim();
  return !s || s.length > 45 || /\.(com|net|org|biz|us)\b|[|–—]|\s-\s|near you|walk-in|\bbest\b|\btop \d/i.test(s) ? null : s;
};
/** Franchise head offices — a cold letter to corporate reaches no one who stocks a front desk. */
const FRANCHISE = /@(thejoint\.com|100percentchiropractic\.com|atipt\.com|hsschiropractic\.com|chirofusion\.com)$/i;

export async function planDay(opts: { date?: string; dryRun?: boolean } = {}): Promise<PlanResult> {
  const sb = db();
  const s = await loadSettings(sb);
  const date = opts.date || ptParts().date;
  const dry = !!opts.dryRun;
  const empty = (skipped: string): PlanResult => ({ date, skipped, rows: [], counts: {}, pools: {}, notes: [] });
  if (!dry) {
    if (!s.enabled) return empty("disabled");
    if (s.start_date && date < s.start_date) return empty(`starts ${s.start_date}`);
    if (s.paused_on === date) return empty("paused today");
    if (isWeekendDate(date)) return empty("weekend");
    if (s.last_plan_date && s.last_plan_date >= date) return empty("already planned");
  }

  const notes: string[] = [];
  const t0 = Date.now();
  const mark = (label: string) => notes.push(`${label} @${((Date.now() - t0) / 1000).toFixed(1)}s`);
  let caps: Record<Lane, number> = { ...DEFAULT_CAPS, ...(s.lane_caps || {}) } as Record<Lane, number>;
  const cap = s.daily_cap;
  const ref = ptToUtc(date, 12 * 60).getTime();
  const age = (iso: string) => Math.floor((ref - Date.parse(iso.length === 10 ? iso + "T12:00:00Z" : iso)) / DAY_MS);

  // Expire what didn't go out on its own day — relative to TODAY, not the plan
  // date: tomorrow's batch is planned at 4pm while today's may still be sending.
  if (!dry) await sb.from("growth_queue").update({ status: "skipped", skip_reason: "not sent on its day" }).eq("status", "planned").lt("plan_date", ptParts().date);

  const [sup, events, queue, portal, prospects, samples, products] = await Promise.all([
    fetchAll<any>(() => sb.from("growth_suppression").select("email")),
    fetchAll<any>(() => sb.from("growth_events").select("email, kind, at").gte("at", new Date(ref - 60 * DAY_MS).toISOString())),
    fetchAll<any>(() => sb.from("growth_queue").select("id, email, lane, step, status, dedupe_key, sent_at, subject, gmail_thread_id, message_id_header, meta, name, business, qb_customer_id").in("status", ["planned", "sending", "sent", "rejected"])),
    fetchAll<any>(() => sb.from("customers").select("email")),
    fetchAll<any>(() => sb.from("outreach_prospects").select("id, name, business, email, type, source, status, touch_count, last_contacted_at, created_at").in("type", ["chiropractor", "club"])),
    fetchAll<any>(() => sb.from("sample_requests").select("*")),
    fetchAll<any>(() => sb.from("products").select("name, qb_sku")),
  ]);
  const skuNames: Record<string, string> = {};
  for (const p of products) if (p.qb_sku) skuNames[String(p.qb_sku).toLowerCase()] = p.name;

  // ── learned from swipes: lane volume + Darrin's own wording ──
  const stats = await laneStats(sb);
  caps = adaptCaps(caps, stats);
  const overflow = [...OVERFLOW_ORDER].sort((a, b) => multiplier(stats[b]) - multiplier(stats[a]));
  const { data: tpls } = await sb.from("growth_templates").select("lane, subject, body");
  const overrides: Record<string, { subject: string; body: string }> = {};
  for (const t of tpls || []) overrides[t.lane] = t;
  /** His template if he's rewritten this lane (and it can be filled for this person), else the built-in. */
  const finalize = (lane: Lane, m: { subject: string; text: string }, vars: Vars) => {
    const o = overrides[lane];
    const r = o ? renderTemplate(o, vars) : null;
    if (!r) return m;
    return { subject: lane.endsWith("bump") ? m.subject : r.subject, text: r.text };
  };

  const suppressed = new Set(sup.map((r) => lower(r.email)));
  const spoke = new Set(events.filter((e) => ["reply", "unsubscribe", "bounce"].includes(e.kind)).map((e) => lower(e.email)));
  const lastContact = new Map<string, number>();
  const touch = (e: string, at: string) => { const t = Date.parse(at); const k = lower(e); if (!(lastContact.get(k)! >= t)) lastContact.set(k, t); };
  for (const e of events) if (e.kind === "contacted") touch(e.email, e.at);
  for (const q of queue) if (q.status === "sent" && q.sent_at) touch(q.email, q.sent_at);
  const usedKeys = new Set(queue.map((q) => q.dedupe_key));
  // Anyone already waiting in a deck (today's or tomorrow's) is not planned twice.
  const taken = new Set<string>(queue.filter((q) => q.status === "planned" || q.status === "sending").map((q) => lower(q.email)));
  const quietDays = (e: string) => (lastContact.has(e) ? (ref - lastContact.get(e)!) / DAY_MS : Infinity);
  const blocked = (e: string, quiet: number) =>
    !e || isInternal(e) || suppressed.has(e) || spoke.has(e) || taken.has(e) || quietDays(e) < quiet;

  mark("db loaded");
  let contacts: Contact[] = [];
  try { contacts = await loadQbContacts(); } catch (e: any) { notes.push("QuickBooks unavailable, customer lanes skipped: " + e.message); }
  mark(`quickbooks loaded (${contacts.length} contacts)`);
  const byEmail = new Map(contacts.map((c) => [c.email, c]));
  const portalEmails = new Set(portal.map((c) => lower(c.email)).filter(Boolean));
  const customerEmails = new Set<string>([...Array.from(portalEmails), ...contacts.filter((c) => c.orders > 0).map((c) => c.email)]);
  const customerDomains = new Set(Array.from(customerEmails).map(domainOf).filter((d) => d && !FREE_MAIL.has(d)));
  const isCustomer = (e: string) => customerEmails.has(e) || customerDomains.has(domainOf(e));

  let token: string | null = null;
  const gmail = async () => (token ??= await getGmailAccess());

  const lanes: Record<Lane, Pre[]> = { sample_followup: [], restock: [], winback_bump: [], cold_bump: [], winback: [], chiro: [], club: [] };
  const base = { reply_to_queue_id: null, prospect_id: null, qb_customer_id: null, meta: {} };

  // ── sample follow-up: a sample went out 12–60 days ago, no order since ──
  for (const r of samples) {
    const e = lower(r.email), when = r.shipped_at || r.created_at;
    if (!e || !when || r.ordered_at) continue;
    const a = age(when);
    if (a < 12 || a > 60) continue;
    const key = `sample:${e}`;
    const c = byEmail.get(e);
    if (usedKeys.has(key) || (c?.lastDate && c.lastDate >= String(when).slice(0, 10))) continue;
    lanes.sample_followup.push({ email: e, quiet: 5, build: async () => {
      const g = greetingFor(r.name, null, null, r.business);
      const vars: Vars = { greeting: g, business: r.business };
      const m = finalize("sample_followup", T.sampleFollowup(g), vars);
      return { ...base, lane: "sample_followup", step: 1, email: e, name: r.name, business: r.business, subject: m.subject, text: m.text, dedupe_key: key, prospect_id: r.prospect_id || null, meta: { greeting: g, sampleAt: when, vars } };
    } });
  }

  // ── restock: past their own reorder cadence, not yet lapsed ──
  for (const c of contacts.filter((c) => c.lastDate && c.orders >= 2 && c.gapDays && c.spent < HOUSE_ACCOUNT && looksWholesale(c)).sort((a, b) => b.spent - a.spent)) {
    const d = age(c.lastDate!);
    const due = Math.max(45, Math.round(c.gapDays! * 1.15));
    if (d < due || d >= 150) continue;
    const key = `restock:${c.email}:${c.lastDate}`;
    if (usedKeys.has(key)) continue;
    lanes.restock.push({ email: c.email, quiet: 21, build: async () => {
      const g = greetingFor(c.display, c.given, c.family, c.company);
      const lastOrder = await lastOrderSummary(c.qbId, skuNames);
      const vars: Vars = { greeting: g, business: c.company, last_date: monthDay(c.lastDate!), weeks: `about ${Math.round(d / 7)} weeks`, gap: `every ${c.gapDays} days`, last_order: lastOrder };
      const m = finalize("restock", T.restock(g, { lastDate: c.lastDate!, days: d, gapDays: c.gapDays!, lastOrder, portal: portalEmails.has(c.email) }), vars);
      return { ...base, lane: "restock", step: 1, email: c.email, name: c.display, business: c.company, subject: m.subject, text: m.text, dedupe_key: key, qb_customer_id: c.qbId, meta: { greeting: g, lastDate: c.lastDate, days: d, gap: c.gapDays, spent: c.spent, vars } };
    } });
  }

  // ── win-back nudge: one in-thread reminder 6–14 days after the offer ──
  for (const q of queue.filter((q) => q.lane === "winback" && q.step === 1 && q.status === "sent" && q.sent_at)) {
    const a = age(q.sent_at);
    if (a < 6 || a > 14) continue;
    const key = String(q.dedupe_key).replace(/:1$/, ":2");
    const c = byEmail.get(lower(q.email));
    if (usedKeys.has(key) || (c?.lastDate && q.meta?.lastDate && c.lastDate > q.meta.lastDate)) continue;
    lanes.winback_bump.push({ email: lower(q.email), quiet: 5, build: async () => {
      const t = await gmail();
      if (!t || !q.gmail_thread_id || (await threadHasMessageFrom(t, q.gmail_thread_id, q.email))) return null;
      const vars: Vars = { greeting_short: shortGreeting(q.meta?.greeting || "Hi,") };
      const m = finalize("winback_bump", T.winbackBump(q.meta?.greeting || "Hi", q.subject), vars);
      return { ...base, lane: "winback_bump", step: 2, email: lower(q.email), name: q.name, business: q.business, subject: m.subject, text: m.text, dedupe_key: key, reply_to_queue_id: q.id, qb_customer_id: q.qb_customer_id, meta: { threadId: q.gmail_thread_id, inReplyTo: q.message_id_header, lastDate: q.meta?.lastDate, vars } };
    } });
  }

  // ── cold follow-up: the single bump, 6–21 days after the first letter ──
  for (const p of prospects.filter((p) => p.status === "emailed" && p.touch_count === 1 && p.last_contacted_at).sort((a, b) => a.last_contacted_at.localeCompare(b.last_contacted_at))) {
    const e = lower(p.email), a = age(p.last_contacted_at);
    if (a < 6 || a > 21) continue;
    const key = `cold:${e}:2`;
    if (usedKeys.has(key)) continue;
    lanes.cold_bump.push({ email: e, quiet: 5, build: async () => {
      const t = await gmail();
      if (!t) return null;
      const orig = await latestSentTo(t, e, 45);
      if (!orig || (await threadHasMessageFrom(t, orig.threadId, e))) return null;
      // Reuse the exact greeting the first letter opened with.
      const g = (orig.snippet.match(/^(.{2,60}?,)\s/) || [])[1] || (p.name ? `Hi ${String(p.name).split(" ")[0]},` : "Hello,");
      // A garbled original subject gets a clean one; Gmail only threads on an
      // exact subject match, so that bump starts a fresh thread on our side
      // (In-Reply-To still threads it for the recipient).
      const raw = orig.h.subject || "Active 10";
      const subject = fixMojibake(raw);
      const vars: Vars = { greeting: g };
      // Club and chiro bumps differ in voice, so only chiro bumps take his template.
      const built = T.coldBump(p.type === "club" ? "club" : "chiro", g, subject);
      const m = p.type === "club" ? built : finalize("cold_bump", built, vars);
      return { ...base, lane: "cold_bump", step: 2, email: e, name: cleanBusiness(p.business) || shortGreeting(g), business: p.business, subject: m.subject, text: m.text, dedupe_key: key, prospect_id: p.id, meta: { threadId: orig.threadId, newThread: subject !== raw, inReplyTo: orig.h["message-id"] || null, greeting: g, vars } };
    } });
  }

  // ── win-back: lapsed 4 months to 6 years, most recently lapsed first ──
  const lapsed = contacts
    .filter((c) => c.lastDate && c.spent > 0 && c.spent < HOUSE_ACCOUNT && looksWholesale(c))
    .map((c) => ({ c, d: age(c.lastDate!) }))
    .filter(({ c, d }) => d >= (c.orders >= 2 ? 150 : 120) && d <= 6 * 365)
    .sort((a, b) => Math.floor(a.d / 365) - Math.floor(b.d / 365) || b.c.spent - a.c.spent);
  for (const { c, d } of lapsed) {
    const key = `winback:${c.email}:${c.lastDate}:1`;
    if (usedKeys.has(key)) continue;
    lanes.winback.push({ email: c.email, quiet: 21, build: async () => {
      const g = greetingFor(c.display, c.given, c.family, c.company);
      const vars: Vars = { greeting: g, business: c.company, last_month_year: monthYear(c.lastDate!) };
      const m = finalize("winback", T.winback(g, { lastDate: c.lastDate!, portal: portalEmails.has(c.email) }), vars);
      return { ...base, lane: "winback", step: 1, email: c.email, name: c.display, business: c.company, subject: m.subject, text: m.text, dedupe_key: key, qb_customer_id: c.qbId, meta: { greeting: g, lastDate: c.lastDate, days: d, spent: c.spent, orders: c.orders, vars } };
    } });
  }

  // ── cold first touch: chiropractors (work domains first), then DCA clubs ──
  const workFirst = (a: any, b: any) =>
    (FREE_MAIL.has(domainOf(lower(a.email))) ? 1 : 0) - (FREE_MAIL.has(domainOf(lower(b.email))) ? 1 : 0) || String(a.created_at).localeCompare(String(b.created_at));
  for (const p of prospects.filter((p) => p.type === "chiropractor" && p.status === "prospected" && p.email).sort(workFirst)) {
    const e = lower(p.email), business = cleanBusiness(p.business);
    const key = `chiro:${e}:1`;
    if (!business || isCustomer(e) || FRANCHISE.test(e) || usedKeys.has(key)) continue;
    lanes.chiro.push({ email: e, quiet: 60, build: async () => {
      const g = p.name && /^Dr\.?\s+[A-Za-z' -]{2,25}$/.test(p.name) ? `${String(p.name).replace(/^Dr\.?\s+/, "Dr. ")},` : `Hi ${business} team,`;
      const vars: Vars = { greeting: g, business };
      const m = finalize("chiro", T.chiroFirst(g, business), vars);
      return { ...base, lane: "chiro", step: 1, email: e, name: p.name, business, subject: m.subject, text: m.text, dedupe_key: key, prospect_id: p.id, meta: { greeting: g, vars } };
    } });
  }
  for (const p of prospects.filter((p) => p.type === "club" && p.status === "prospected" && p.email).sort(workFirst)) {
    const e = lower(p.email);
    const key = `club:${e}:1`;
    if (isCustomer(e) || usedKeys.has(key) || /sleepy hollow/i.test(p.business || "")) continue;
    lanes.club.push({ email: e, quiet: 60, build: async () => {
      const first = p.name ? String(p.name).split(" ")[0] : null;
      const vars: Vars = { first_name: first, business: p.business };
      const m = finalize("club", T.clubFirst(p.name, p.business), vars);
      return { ...base, lane: "club", step: 1, email: e, name: p.name, business: p.business, subject: m.subject, text: m.text, dedupe_key: key, prospect_id: p.id, meta: { greeting: first ? `Hi ${first},` : null, vars } };
    } });
  }

  // ── fill: each lane up to its cap in priority order, then overflow ──
  const chosen: Cand[] = [];
  const counts: Record<string, number> = {};
  const take = async (lane: Lane, limit: number) => {
    for (const pre of lanes[lane]) {
      if (chosen.length >= cap || (counts[lane] || 0) >= limit) return;
      if (pre.used || blocked(pre.email, pre.quiet)) continue;
      pre.used = true;
      let c: Cand | null = null;
      try { c = await pre.build(); } catch (e: any) { notes.push(`${lane} ${pre.email}: ${String(e.message).slice(0, 120)}`); }
      if (!c) continue;
      taken.add(pre.email);
      chosen.push(c);
      counts[lane] = (counts[lane] || 0) + 1;
    }
  };
  for (const l of LANE_ORDER) { await take(l, caps[l]); mark(`lane ${l}`); }
  for (const l of overflow) if (chosen.length < cap) await take(l, cap);
  mark("filled");

  const pools: Record<string, number> = {};
  for (const l of LANE_ORDER) pools[l] = lanes[l].filter((p) => !p.used && !blocked(p.email, p.quiet)).length;

  // ── schedule: interleave lanes, spread across the send window ──
  const buckets = LANE_ORDER.map((l) => chosen.filter((c) => c.lane === l));
  const ordered: Cand[] = [];
  while (ordered.length < chosen.length) for (const b of buckets) if (b.length) ordered.push(b.shift()!);
  const span = s.window_end - s.window_start;
  const step = span / Math.max(1, ordered.length);
  const rows: PlanRow[] = ordered.map((c, i) => {
    const minute = Math.round(s.window_start + i * step + Math.random() * step * 0.6);
    const body_text = withFooter(c.text, s.footer_address);
    const { text: _t, ...rest } = c;
    return { ...rest, plan_date: date, send_at: ptToUtc(date, minute).toISOString(), body_text, body_html: toHtml(body_text) };
  });

  if (!dry) {
    if (rows.length) {
      const { error } = await sb.from("growth_queue").insert(rows);
      if (error) for (const r of rows) { const { error: e1 } = await sb.from("growth_queue").insert(r); if (e1) notes.push(`queue ${r.email}: ${e1.message}`); }
    }
    await sb.from("growth_settings").update({ last_plan_date: date, updated_at: new Date().toISOString() }).eq("id", "default");
  }
  return { date, rows, counts, pools, notes };
}
