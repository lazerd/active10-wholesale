import { NextRequest, NextResponse } from "next/server";
import { planDay } from "@/lib/growth/planner";

// Preview what the engine would send on a given day — builds the exact rows the
// send path uses, writes nothing. GET /api/growth/plan?date=YYYY-MM-DD
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.GROWTH_SECRET || auth !== `Bearer ${process.env.GROWTH_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date") || undefined;
  try {
    return NextResponse.json({ ok: true, ...(await planDay({ date, dryRun: true })) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
