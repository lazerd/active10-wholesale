/**
 * growth-preview.ts — show exactly what the growth engine would send on a day.
 * Builds the same rows the send path uses; writes nothing.
 *
 *   npx tsx --env-file=.env.local scripts/growth-preview.ts 2026-09-14
 *   npx tsx --env-file=.env.local scripts/growth-preview.ts 2026-09-14 --json out.json
 */
import fs from "fs";
import { planDay } from "../src/lib/growth/planner";

const date = process.argv[2];
const jsonAt = process.argv.indexOf("--json");
// --commit writes the batch into growth_queue (i.e. fills the /swipe deck) instead of previewing.
const commit = process.argv.includes("--commit");

planDay({ date, dryRun: !commit }).then((r) => {
  if (r.skipped) console.log("skipped:", r.skipped);
  console.log("counts", r.counts);
  console.log("pools ", r.pools);
  for (const n of r.notes) console.log("  ·", n);
  for (const row of r.rows) {
    const t = new Date(row.send_at).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
    console.log(`${t.padStart(8)}  ${row.lane.padEnd(15)} ${(row.name || row.business || "").slice(0, 28).padEnd(28)} ${row.email.padEnd(38)} ${row.subject}`);
  }
  if (jsonAt > 0) fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(r, null, 1));
}).catch((e) => { console.error("FAILED:", e); process.exit(1); });
