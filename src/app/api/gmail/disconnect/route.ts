import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST() {
  await supabase.from("gmail_tokens").delete().eq("id", "default");
  return NextResponse.json({ ok: true });
}
