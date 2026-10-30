// Invoice chaser by hand.
//   npx tsx --env-file=.env.local scripts/invoice-chaser.ts            preview (sends nothing)
//   npx tsx --env-file=.env.local scripts/invoice-chaser.ts --live     send what's due now
//   npx tsx --env-file=.env.local scripts/invoice-chaser.ts --live 16245 16250   only these invoice numbers
import { db } from "../src/lib/growth/config";
import { runChase } from "../src/lib/invoiceChaser";

const live = process.argv.includes("--live");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  const r = await runChase(db(), { live, only: only.length ? only : undefined });
  const days = (d: string | null) => (d ? `${Math.round((Date.now() - new Date(d).getTime()) / 86400000)}d ago` : "never");
  const groups: Record<string, typeof r.items> = {};
  for (const i of r.items) (groups[i.action] ||= []).push(i);
  for (const k of ["first", "resend", "wait", "maxed", "no_email", "excluded", "too_old"]) {
    const g = groups[k]; if (!g?.length) continue;
    const total = g.reduce((s, i) => s + i.balance, 0);
    console.log(`\n== ${k.toUpperCase()} (${g.length}, $${total.toFixed(2)})`);
    for (const i of g) console.log(`  #${i.doc.padEnd(6)} ${i.txnDate}  $${i.balance.toFixed(2).padStart(9)}  ${i.customer.slice(0, 38).padEnd(38)} ${(i.email || "-").padEnd(32)} sent ${days(i.lastSent)}`);
  }
  console.log(`\n${live ? "SENT" : "WOULD SEND"}: ${live ? r.sent.length : r.due.length}` + (r.failed.length ? `  FAILED: ${r.failed.length}` : ""));
  for (const f of r.failed) console.log("  FAIL", f.item.doc, f.error);
})().catch((e) => { console.error(e); process.exit(1); });
