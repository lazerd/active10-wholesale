import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/growth/tick";

// Heartbeat for the growth engine. Called every 10 minutes by Supabase pg_cron
// (job "growth-tick", secret in Supabase Vault) and once a day by Vercel cron
// as a backup. Safe to call any time: it only sends what is due.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.GROWTH_SECRET, process.env.CRON_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  return ok;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await tick()) });
  } catch (e: any) {
    console.error("growth/tick:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
