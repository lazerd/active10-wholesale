// 11/17: today's chiro letters were planned with the old letters. Swap them for F and fill today to the new 100 cap.
// npx tsx --env-file=<prod env> scripts/_replan-today.ts [--go]
import { createClient } from "@supabase/supabase-js";
import { planDay } from "../src/lib/growth/planner";
import { ptParts } from "../src/lib/growth/config";
(async () => {
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const today = ptParts().date, go = process.argv.includes("--go");
if (!go) {
  const r = await planDay({ date: today, dryRun: true });
  console.log("DRY", r.counts, r.pools, r.notes.filter((n) => !n.includes("@")));
} else {
  const { data: old } = await sb.from("growth_queue").update({ status: "skipped", skip_reason: "replaced by F free-tubes letter 11/17" })
    .eq("plan_date", today).eq("status", "planned").eq("lane", "chiro").select("id");
  console.log("old chiro rows replaced:", old?.length);
  await sb.from("growth_settings").update({ last_plan_date: "2026-11-16" }).eq("id", "default");
  const r = await planDay({ date: today });
  console.log("PLANNED", r.counts, r.notes.filter((n) => !n.includes("@")));
}

})().catch((e) => { console.error(e); process.exit(1); });
