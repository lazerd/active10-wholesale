// Fill the chiro buffer right now (same code the tick runs). npx tsx --env-file=<prod env> scripts/_discover-now.ts <minutes> <buffer>
import { createClient } from "@supabase/supabase-js";
import { discover } from "../src/lib/growth/discover";
(async () => {
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const mins = Number(process.argv[2] || 10), want = Number(process.argv[3] || 300);
const { data: s } = await sb.from("growth_settings").select("*").eq("id", "default").single();
const r: any = await discover(sb, s as any, Date.now() + mins * 60000, { buffer: want });
for (const x of r.runs || []) console.log(`${x.added} new / ${x.looked} sites  ${x.q}`);
console.log("TOTAL added", r.added, "buffer", r.buffer, r.skipped || "");

})().catch((e) => { console.error(e); process.exit(1); });
