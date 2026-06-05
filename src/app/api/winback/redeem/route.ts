import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Called right after an order is placed with a win-back code. Marks the offer
// redeemed and records the recovered revenue. Idempotent-ish: only flips a
// 'sent' offer to 'redeemed'.
export async function POST(req: NextRequest) {
  try {
    const { code, orderId, customerId } = await req.json();
    if (!code || !orderId) return NextResponse.json({ error: "Missing code or order" }, { status: 400 });

    const { data: offer } = await supabaseAdmin
      .from("winback_offers")
      .select("id, customer_id, status")
      .ilike("code", String(code))
      .single();
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (customerId && offer.customer_id && offer.customer_id !== customerId) {
      return NextResponse.json({ error: "Offer does not belong to this customer" }, { status: 403 });
    }
    if (offer.status === "redeemed") return NextResponse.json({ ok: true, alreadyRedeemed: true });

    const { data: order } = await supabaseAdmin.from("orders").select("total").eq("id", orderId).single();
    const revenue = order ? Number(order.total) : null;

    await supabaseAdmin
      .from("winback_offers")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_order_id: orderId, revenue_recovered: revenue })
      .eq("id", offer.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("winback/redeem error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
