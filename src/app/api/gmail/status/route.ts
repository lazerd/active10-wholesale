import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Never cache — must reflect the live token state in the DB.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const { data } = await supabase.from("gmail_tokens").select("email, refresh_token").eq("id", "default").single();
  const connected = !!(data && data.refresh_token);
  return NextResponse.json({ connected, email: data?.email || null, configured: !!process.env.GOOGLE_CLIENT_ID });
}
