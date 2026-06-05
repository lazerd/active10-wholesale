import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { balances } from "@/lib/credit";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ available: 0, pending: 0 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ available: 0, pending: 0 });
    const { data: cust } = await supabaseAdmin.from("customers").select("id").ilike("email", email).single();
    if (!cust) return NextResponse.json({ available: 0, pending: 0 });
    const { data: rows } = await supabaseAdmin.from("customer_credits").select("amount, kind, status, expires_at").eq("customer_id", cust.id);
    return NextResponse.json(balances(rows || []));
  } catch {
    return NextResponse.json({ available: 0, pending: 0 });
  }
}
