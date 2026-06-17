import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();

    if (body.action === "list") {
      const { data } = await supabaseAdmin.from("sample_requests").select("*").order("created_at", { ascending: false });
      return NextResponse.json({ ok: true, requests: data || [] });
    }

    if (body.action === "mark_shipped") {
      const status = body.shipped === false ? "requested" : "shipped";
      await supabaseAdmin.from("sample_requests").update({ status }).eq("id", body.id);
      return NextResponse.json({ ok: true, status });
    }

    if (body.action === "delete") {
      await supabaseAdmin.from("sample_requests").delete().eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
