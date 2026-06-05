import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      // Record the first open only; never downgrade a redeemed offer.
      const { data: o } = await supabaseAdmin.from("winback_offers").select("id, opened_at, status").eq("id", id).single();
      if (o && !o.opened_at) await supabaseAdmin.from("winback_offers").update({ opened_at: new Date().toISOString() }).eq("id", id);
    }
  } catch {
    /* never block the pixel on a tracking error */
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" },
  });
}
