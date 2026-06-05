import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns the logged-in customer's most recent (non-cancelled) order, for the
// one-click "Order Again" feature. Token-verified, scoped to that customer.
export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: cust } = await supabaseAdmin.from("customers").select("id").ilike("email", email).single();
    if (!cust) return NextResponse.json({ order: null });

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("order_number, created_at, items, total, status")
      .eq("customer_id", cust.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1);

    const order = orders && orders[0] ? orders[0] : null;
    return NextResponse.json({ order });
  } catch (err: any) {
    console.error("my-last-order error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
