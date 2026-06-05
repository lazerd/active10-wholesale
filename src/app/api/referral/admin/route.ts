import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantReferralForOrder } from "@/lib/referralGrant";

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

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { action } = await req.json();

    if (action === "reconcile") {
      const { data: refCusts } = await supabaseAdmin.from("customers").select("id").not("referred_by_customer_id", "is", null);
      const ids = (refCusts || []).map((c) => c.id);
      let granted = 0;
      if (ids.length) {
        const { data: orders } = await supabaseAdmin.from("orders").select("id, customer_id, status").in("customer_id", ids).in("status", ["confirmed", "shipped", "delivered"]);
        for (const o of orders || []) {
          const res = await grantReferralForOrder(supabaseAdmin, o.id);
          if (res.granted) granted++;
        }
      }
      return NextResponse.json({ ok: true, granted });
    }

    // default: list
    const { data: refs } = await supabaseAdmin.from("referrals").select("*").order("created_at", { ascending: false });
    const referrals = refs || [];
    const { data: custs } = await supabaseAdmin.from("customers").select("id, name, business");
    const nameById: Record<string, string> = {};
    for (const c of custs || []) nameById[c.id] = c.business || c.name;
    const { data: credits } = await supabaseAdmin.from("customer_credits").select("amount, kind");
    const grantedTotal = (credits || []).filter((c) => c.kind === "referral_reward").reduce((s, c) => s + Number(c.amount), 0);
    const redeemedTotal = (credits || []).filter((c) => c.kind === "redemption").reduce((s, c) => s + Number(c.amount), 0);

    const rows = referrals.map((r) => ({
      referrer: nameById[r.referrer_customer_id] || "—",
      referredEmail: r.referred_email,
      referredName: r.referred_name,
      status: r.status,
      reward: Number(r.reward_amount),
      createdAt: r.created_at,
    }));

    const summary = {
      invited: referrals.filter((r) => r.status === "invited").length,
      joined: referrals.filter((r) => r.status === "joined").length,
      qualified: referrals.filter((r) => r.status === "qualified").length,
      rewardsGranted: r2(grantedTotal),
      creditRedeemed: r2(-redeemedTotal),
      creditOutstanding: r2(grantedTotal + redeemedTotal),
    };
    return NextResponse.json({ ok: true, referrals: rows, summary });
  } catch (err: any) {
    console.error("referral/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
