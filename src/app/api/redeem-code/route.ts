import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Live promo codes. `expires` (if set) kills the code at that UTC instant;
// `oncePerCustomer` is enforced via the order-marker check below.
const PROMO_CODES: Record<string, { discount: number; freeShipping: boolean; expires?: string; oncePerCustomer: boolean }> = {
  DCAMEMBERSONLY: { discount: 0.2, freeShipping: true, oncePerCustomer: true },
  // 4th of July sale — advertised through July 13; grace-extended through
  // Friday July 17 (midnight Pacific) after the July 14-15 portal outage
  // blocked customers mid-order.
  FIREWORKS: { discount: 0.2, freeShipping: false, expires: "2026-07-18T07:00:00Z", oncePerCustomer: false },
};

// A customer has used a code if any prior order carries the marker. We write
// the code into both `tier_name` and `notes` at order time (no dedicated column
// exists on the orders table), so we look in both places to be safe.
async function hasUsedCode(customerId: string, code: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .or(`tier_name.ilike.%${code}%,notes.ilike.%${code}%`)
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

    // 1) House promo codes (hardcoded above).
    const promo = PROMO_CODES[entered];
    if (promo) {
      if (promo.expires && new Date(promo.expires) < new Date()) {
        return NextResponse.json({ ok: false, error: "This code has expired." });
      }
      if (promo.oncePerCustomer && (await hasUsedCode(customerId, entered))) {
        return NextResponse.json({ ok: false, alreadyUsed: true, error: "This code has already been used on your account." });
      }
      return NextResponse.json({
        ok: true,
        code: entered,
        type: "promo",
        discount: promo.discount,
        freeShipping: promo.freeShipping,
        message: `Code applied! ${Math.round(promo.discount * 100)}% off${promo.freeShipping ? " + free shipping" : ""}.`,
      });
    }

    // 2) A personal win-back code: must belong to this customer, be sent, unredeemed, unexpired.
    const { data: offer } = await supabaseAdmin
      .from("winback_offers")
      .select("id, customer_id, discount_pct, free_shipping, status, expires_at, sample_packets, kind")
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
      const minOrder = offer.kind === "referral_welcome" ? 100 : 0; // referral welcome requires $100+ first order
      const extras = [offer.free_shipping ? "free shipping" : "", samples > 0 ? `${samples} free sample packets` : ""].filter(Boolean).join(" + ");
      return NextResponse.json({
        ok: true,
        code: entered,
        type: "winback",
        discount: pct,
        freeShipping: !!offer.free_shipping,
        samplePackets: samples,
        minOrder,
        message: `Code applied! ${Math.round(pct * 100)}% off${extras ? " + " + extras : ""}.`,
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid discount code." });
  } catch (err: any) {
    console.error("redeem-code error:", err);
    return NextResponse.json({ ok: false, error: "Could not validate code. Please try again." }, { status: 500 });
  }
}
