import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json({ connected: false, error: "missing_env", url: !!url, key: !!key });
    }

    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("qb_tokens")
      .select("*")
      .eq("id", "default")
      .single();

    if (error) {
      return NextResponse.json({ connected: false, error: error.message, code: error.code });
    }

    if (!data) {
      return NextResponse.json({ connected: false, error: "no_data" });
    }

    return NextResponse.json({ connected: true, realmId: data.realm_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ connected: false, error: msg });
  }
}
