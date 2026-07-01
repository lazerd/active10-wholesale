import { NextRequest, NextResponse } from "next/server";
import { prepareBatch } from "@/lib/outreachBatch";

// Daily weekday cron: prepares (never sends) the day's club outreach drafts so
// Darrin just reviews + one-click sends. Wired in vercel.json.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth: Vercel cron requests carry x-vercel-cron; also accept a CRON_SECRET bearer.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isVercelCron = !!req.headers.get("x-vercel-cron");
  if (!isVercelCron && !(secret && auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip weekends (evaluate in Eastern time).
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date());
  if (wd === "Sat" || wd === "Sun") return NextResponse.json({ ok: true, skipped: "weekend" });

  try {
    const res = await prepareBatch();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    console.error("outreach/cron error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
