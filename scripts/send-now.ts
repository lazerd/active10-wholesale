/**
 * send-now.ts — sends APPROVED planned rows of one lane right away, one every GAP seconds,
 * through the same sendDue() the tick uses (same suppression / wrote-in / already-sent checks).
 * Exists because the tick only sends 2 per 10-minute run inside the PT window. Darrin 10/8: "we are going too slow".
 *   npx tsx --env-file=.env.local scripts/send-now.ts case_deal [gapSec=45]
 */
import { db, loadSettings } from "../src/lib/growth/config";
import { getGmailAccess } from "../src/lib/gmail";
import { sendDue } from "../src/lib/growth/tick";

const lane = process.argv[2]; const gap = Number(process.argv[3] || 45) * 1000;
if (!lane) throw new Error("usage: send-now.ts <lane> [gapSec]");
(async () => {
  const sb = db(); const s = await loadSettings(sb);
  const { data: rows } = await sb.from("growth_queue").select("id").eq("lane", lane).eq("status", "planned").eq("approval", "approved").order("send_at");
  const ids = (rows || []).map((r) => r.id);
  console.log(`${ids.length} ${lane} rows to send now`);
  const t = Date.now();
  // Pull them all to "due now", keeping their order, so sendDue picks them one at a time.
  for (let i = 0; i < ids.length; i++) await sb.from("growth_queue").update({ send_at: new Date(t - (ids.length - i) * 1000).toISOString() }).eq("id", ids[i]);
  let sent = 0, skipped = 0;
  for (;;) {
    const token = await getGmailAccess(); if (!token) throw new Error("Gmail disconnected");
    const r = await sendDue(sb, token, 1, true, s);
    if (!r.length) break;
    for (const x of r) { if (x.sent) sent++; else skipped++; console.log(new Date().toISOString(), JSON.stringify(x)); }
    if (r.some((x) => x.error && /401|403|429/.test(x.error))) { console.log("Gmail refused — stopping"); break; }
    await new Promise((res) => setTimeout(res, gap));
  }
  console.log(`done: sent ${sent}, skipped/failed ${skipped}`);
})();
