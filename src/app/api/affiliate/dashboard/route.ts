import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Affiliate, eligibleOrders, isPayable, orderCommission, round2 } from "@/lib/affiliate";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE = "https://wholesale.getactive10.com";

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const email = userData.user.email.toLowerCase();

    const { data: aff } = await supabaseAdmin.from("affiliates").select("*").ilike("email", email).single();
    if (!aff) return NextResponse.json({ error: "Not an affiliate" }, { status: 403 });
    const affiliate = aff as Affiliate;

    // Referred customers + their orders
    const { data: custs } = await supabaseAdmin
      .from("customers")
      .select("id, name, business, city, created_at, total_orders, total_spent")
      .eq("affiliate_id", affiliate.id);
    const customers = custs || [];

    const ids = customers.map((c) => c.id);
    const { data: ords } = ids.length
      ? await supabaseAdmin.from("orders").select("id, customer_id, subtotal, total, status, created_at").in("customer_id", ids)
      : { data: [] as any[] };
    const orders = ords || [];

    let payableEarned = 0;
    let pendingEarned = 0;

    const rows = customers.map((c) => {
      const cOrders = orders.filter((o) => o.customer_id === c.id);
      const elig = eligibleOrders(cOrders as any, c as any, affiliate);
      let payable = 0;
      let pending = 0;
      for (const o of elig) {
        const comm = orderCommission(o as any, affiliate);
        if (isPayable(o.status)) payable += comm;
        else pending += comm;
      }
      payableEarned += payable;
      pendingEarned += pending;
      return {
        name: c.name,
        business: c.business,
        city: c.city,
        joined: c.created_at,
        orderCount: cOrders.filter((o) => o.status !== "cancelled").length,
        payable: round2(payable),
        pending: round2(pending),
      };
    });

    const { data: payouts } = await supabaseAdmin.from("affiliate_payouts").select("amount").eq("affiliate_id", affiliate.id);
    const paidOut = round2((payouts || []).reduce((s, p) => s + Number(p.amount), 0));
    const owed = round2(Math.max(0, payableEarned - paidOut));

    return NextResponse.json({
      affiliate: {
        name: affiliate.name,
        slug: affiliate.slug,
        commission_rate: affiliate.commission_rate,
        commission_rule: affiliate.commission_rule,
        status: affiliate.status,
      },
      referralUrl: `${SITE}/r/${affiliate.slug}`,
      stats: {
        referredCount: customers.length,
        payableEarned: round2(payableEarned),
        pendingEarned: round2(pendingEarned),
        paidOut,
        owed,
      },
      customers: rows.sort((a, b) => +new Date(b.joined) - +new Date(a.joined)),
    });
  } catch (err: any) {
    console.error("affiliate/dashboard error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
