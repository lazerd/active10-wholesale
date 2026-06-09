import type { SupabaseClient } from "@supabase/supabase-js";

const PAYABLE = ["confirmed", "shipped", "delivered"];
const MIN_QUALIFYING_SUBTOTAL = 100; // referred practice's first order must be $100+ (pre-discount)

// Grants the referrer their store credit once the referred practice's order is
// confirmed AND meets the $100 minimum. Idempotent: only fires when a referral
// is still 'joined'.
export async function grantReferralForOrder(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from("orders").select("id, customer_id, status, subtotal").eq("id", orderId).single();
  if (!order || !PAYABLE.includes(order.status)) return { granted: false };
  if (Number(order.subtotal) < MIN_QUALIFYING_SUBTOTAL) return { granted: false, reason: "below_minimum" };

  const { data: cust } = await admin.from("customers").select("id, referred_by_customer_id").eq("id", order.customer_id).single();
  if (!cust || !cust.referred_by_customer_id) return { granted: false };

  const { data: ref } = await admin.from("referrals").select("*").eq("referred_customer_id", cust.id).eq("status", "joined").limit(1).single();
  if (!ref) return { granted: false };

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 12);

  await admin.from("customer_credits").insert({
    customer_id: ref.referrer_customer_id,
    amount: Number(ref.reward_amount),
    kind: "referral_reward",
    status: "available",
    referral_id: ref.id,
    order_id: orderId,
    expires_at: expires.toISOString(),
    note: "Referral reward — your referred practice placed their first confirmed order",
  });
  await admin.from("referrals").update({ status: "qualified", qualified_at: new Date().toISOString() }).eq("id", ref.id);

  return { granted: true, amount: Number(ref.reward_amount), referrerId: ref.referrer_customer_id };
}
