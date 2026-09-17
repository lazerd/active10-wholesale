/**
 * rerender-cold-bump.ts — re-render undecided chiro cold follow-up cards with the
 * current coldBump() wording. Swiped cards and club bumps are left alone.
 *
 *   npx tsx --env-file=.env.local scripts/rerender-cold-bump.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/rerender-cold-bump.ts --commit
 */
import { db, toHtml } from "../src/lib/growth/config";
import * as T from "../src/lib/growth/templates";

const commit = process.argv.includes("--commit");

(async () => {
  const sb = db();

  // A saved rewrite in growth_templates would override the built-in email at plan time.
  const { data: tpls } = await sb.from("growth_templates").select("lane").eq("lane", "cold_bump");
  if (tpls?.length) console.log("⚠ a saved cold_bump template exists and will override future batches");

  const { data: rows, error } = await sb.from("growth_queue")
    .select("id, subject, body_text, meta, prospect_id, name, email")
    // No date floor: the deck can still hold yesterday's undecided batch.
    .eq("lane", "cold_bump").eq("status", "planned").eq("approval", "pending");
  if (error) throw error;

  const ids = (rows || []).map((r) => r.prospect_id).filter(Boolean);
  const clubs = new Set<string>();
  if (ids.length) {
    const { data: ps } = await sb.from("outreach_prospects").select("id, type").in("id", ids);
    for (const p of ps || []) if (p.type === "club") clubs.add(p.id);
  }

  let n = 0;
  for (const r of rows || []) {
    if (clubs.has(r.prospect_id)) continue;
    const greeting = r.meta?.vars?.greeting || r.meta?.greeting;
    if (!greeting) { console.log(`skip (no greeting): ${r.email}`); continue; }
    const m = T.coldBump("chiro", greeting, r.subject);
    const parts = String(r.body_text).split("\n\n--\n"); // keep the unsubscribe footer
    const body_text = m.text + (parts.length > 1 ? "\n\n--\n" + parts.slice(1).join("\n\n--\n") : "");
    console.log(`\n── ${r.name || r.email} <${r.email}>\n${m.text}`);
    if (commit) {
      await sb.from("growth_queue").update({ body_text, body_html: toHtml(body_text) }).eq("id", r.id);
    }
    n++;
  }
  console.log(`\n${n} card(s) ${commit ? "updated" : "would update"}`);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
