import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Single live promo code. 20% off + free shipping, one redemption per customer.
const CODE = "DCAMEMBERSONLY";
const CODE_DISCOUNT = 0.2;

// A customer has used the code if any prior order carries the marker. We write
// the code into both `tier_name` and `notes` at order time (no dedicated column
// exists on the orders table), so we look in both places to be safe.
async function hasUsedCode(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .or(`tier_name.ilike.%${CODE}%,notes.ilike.%${CODE}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length || 0) > 0;
}

export async function POST(req: NextRequest) {
  try {
    const { customerId, code } = await req.json();

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customer." }, { status: 400 });
    }
    const entered = String(code || "").trim().toUpperCase();
    if (!entered) {
      return NextResponse.json({ ok: false, error: "Enter a code." });
    }

    // 1) The evergreen members promo (one redemption per customer).
    if (entered === CODE) {
      if (await hasUsedCode(customerId)) {
        return NextResponse.json({ ok: false, alreadyUsed: true, error: "This code has already been used on your account." });
      }
      return NextResponse.json({
        ok: true,
        code: CODE,
        type: "promo",
        discount: CODE_DISCOUNT,
        freeShipping: true,
        message: "Code applied! 20% off + free shipping.",
      });
    }

    // 2) A personal win-back code: must belong to this customer, be sent, unredeemed, unexpired.
    const { data: offer } = await supabaseAdmin
      .from("winback_offers")
      .select("id, customer_id, discount_pct, free_shipping, status, expires_at, sample_packets")
      .ilike("code", entered)
      .single();

    if (offer && offer.customer_id === customerId) {
      if (offer.status === "redeemed") {
        return NextResponse.json({ ok: false, alreadyUsed: true, error: "This code has already been used." });
      }
      if (offer.status !== "sent") {
        return NextResponse.json({ ok: false, error: "This code isn't active." });
      }
      if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
        return NextResponse.json({ ok: false, error: "This code has expired." });
      }
      const pct = Number(offer.discount_pct);
      const samples = Number(offer.sample_packets || 0);
      const extras = [offer.free_shipping ? "free shipping" : "", samples > 0 ? `${samples} free sample packets` : ""].filter(Boolean).join(" + ");
      return NextResponse.json({
        ok: true,
        code: entered,
        type: "winback",
        discount: pct,
        freeShipping: !!offer.free_shipping,
        samplePackets: samples,
        message: `Code applied! ${Math.round(pct * 100)}% off${extras ? " + " + extras : ""}.`,
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid discount code." });
  } catch (err: any) {
    console.error("redeem-code error:", err);
    return NextResponse.json({ ok: false, error: "Could not validate code. Please try again." }, { status: 500 });
  }
}
