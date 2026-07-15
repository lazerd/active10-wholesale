import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uptime-monitor endpoint: exercises a real Postgres query so a hung database
// (like the 2026-07-14 Nano freeze) turns into a non-200 within ~8s instead of
// an indefinite hang. Any non-2xx marks the monitor "down".
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DB_TIMEOUT_MS = 8000;

export async function GET() {
  const started = Date.now();
  try {
    const query = supabaseAdmin.from("admin_emails").select("email").limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db timeout")), DB_TIMEOUT_MS)
    );
    const { error } = (await Promise.race([query, timeout])) as { error: { message: string } | null };
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, db: "up", latencyMs: Date.now() - started });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, db: "down", error: String(err?.message || err), latencyMs: Date.now() - started },
      { status: 503 }
    );
  }
}
