/**
 * queue-case-deal.ts — puts the $8/tube case-deal email for every wholesale customer into the
 * swipe deck for one day. Nothing sends without a right swipe (lane "case_deal" is not an auto lane).
 *
 *   npx tsx --env-file=.env.local scripts/queue-case-deal.ts 2026-10-05          (dry run: prints who)
 *   npx tsx --env-file=.env.local scripts/queue-case-deal.ts 2026-10-05 --write
 *
 * Skips: $10k+ house accounts (Darrin calls those himself), marketplaces/walk-ins, internal,
 * suppressed / unsubscribed / bounced, anyone who wrote in during the last 14 days or was
 * emailed in the last 7, anyone already in a deck, and anyone who hasn't ordered in 2 years.
 */
import { db, fetchAll, isInternal, greetingFor, withFooter, toHtml, ptToUtc, loadSettings, looksWholesale, DAY_MS } from "../src/lib/growth/config";
import { loadQbContacts } from "../src/lib/growth/qb";

const date = process.argv[2];
const write = process.argv.includes("--write");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("usage: queue-case-deal.ts YYYY-MM-DD [--write]");
const lower = (s?: string | null) => (s || "").trim().toLowerCase();
const SIGN = "Darrin Cohen\nFounder, Active 10\n800-636-4130";

function body(greeting: string) {
  return `${greeting}

We ended up with extra stock of our original 4oz tubes, so I'm doing something I don't usually do: a case of 24 for $8 a tube. That's $192 for the case plus shipping, about half our normal wholesale price, and they retail for $29.95.

It's on the portal now as the "Original Tube Case Deal": wholesale.getactive10.com
Or just reply "send a case" and I'll invoice you.

It's only while this batch lasts.

${SIGN}`;
}

(async () => {
  const sb = db();
  const s = await loadSettings(sb);
  const now = Date.now();
  const [sup, events, queue] = await Promise.all([
    fetchAll<any>(() => sb.from("growth_suppression").select("email")),
    fetchAll<any>(() => sb.from("growth_events").select("email, kind, at")),
    fetchAll<any>(() => sb.from("growth_queue").select("email, lane, status, sent_at")),
  ]);
  const blocked = new Set<string>([
    ...sup.map((r) => lower(r.email)),
    ...events.filter((e) => ["unsubscribe", "bounce"].includes(e.kind)).map((e) => lower(e.email)),
    ...events.filter((e) => e.kind === "reply" && now - Date.parse(e.at) < 14 * DAY_MS).map((e) => lower(e.email)),
    ...queue.filter((q) => q.status === "planned" || q.status === "sending" || q.lane === "case_deal").map((q) => lower(q.email)),
    ...queue.filter((q) => q.status === "sent" && q.sent_at && now - Date.parse(q.sent_at) < 7 * DAY_MS).map((q) => lower(q.email)),
  ]);
  const contacts = await loadQbContacts();
  const why: Record<string, number> = {};
  const no = (w: string) => { why[w] = (why[w] || 0) + 1; return false; };
  const seen = new Set<string>();
  const picks = contacts.filter((c) => {
    if (!c.email || !c.lastDate || !(c.spent > 0)) return no("no email / never bought");
    if (seen.has(c.email)) return no("duplicate email"); seen.add(c.email);
    if (!looksWholesale(c)) return no("not a wholesale account");
    if (c.spent >= 10000) return no("$10k+ house account (call them yourself)");
    if (isInternal(c.email)) return no("internal");
    if (now - Date.parse(c.lastDate) > 730 * DAY_MS) return no("no order in 2 years");
    if (blocked.has(lower(c.email))) return no("suppressed / recently in touch / already in a deck");
    return true;
  }).sort((a, b) => b.spent - a.spent);

  console.log(`${picks.length} cards for ${date}. Skipped: ${JSON.stringify(why)}`);
  for (const c of picks.slice(0, 15)) console.log(`  ${c.display} <${c.email}> spent $${Math.round(c.spent)} last ${c.lastDate}`);
  if (!write) return;

  const span = s.window_end - s.window_start, step = span / Math.max(1, picks.length);
  const rows = picks.map((c, i) => {
    const text = withFooter(body(greetingFor(c.display, c.given, c.family, c.company)), s.footer_address);
    return {
      plan_date: date, send_at: ptToUtc(date, Math.round(s.window_start + i * step)).toISOString(), lane: "case_deal", step: 1,
      email: c.email, name: c.display, business: c.company, subject: "a case of tubes for $8 each", body_text: text, body_html: toHtml(text),
      dedupe_key: `case_deal:${lower(c.email)}`, qb_customer_id: c.qbId, approval: "pending",
      meta: { why: `Wholesale customer, $${Math.round(c.spent)} lifetime, last order ${c.lastDate}` },
    };
  });
  const { error } = await sb.from("growth_queue").insert(rows);
  if (error) throw error;
  console.log(`queued ${rows.length}`);
})();
