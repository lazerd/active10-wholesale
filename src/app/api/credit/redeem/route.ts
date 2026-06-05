import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { balances } from "@/lib/credit";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Applies store credit to an order. Server-authoritative: re-checks the live
// balance and caps the redemption to what's actually available.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: cust } = await supabaseAdmin.from("customers").select("id").ilike("email", email).single();
    if (!cust) return NextResponse.json({ error: "No customer" }, { status: 403 });

    const { amount, orderId } = await req.json();
    const want = Number(amount);
    if (!(want > 0)) return NextResponse.json({ ok: true, applied: 0 });

    const { data: rows } = await supabaseAdmin.from("customer_credits").select("amount, kind, status, expires_at").eq("customer_id", cust.id);
    const { available } = balances(rows || []);
    const applied = Math.min(want, available);
    if (applied <= 0) return NextResponse.json({ ok: true, applied: 0 });

    await supabaseAdmin.from("customer_credits").insert({ customer_id: cust.id, amount: -applied, kind: "redemption", status: "applied", order_id: orderId || null, note: "Applied to order" });
    return NextResponse.json({ ok: true, applied: Math.round(applied * 100) / 100 });
  } catch (err: any) {
    console.error("credit/redeem error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
