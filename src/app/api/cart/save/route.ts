import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function customerFromToken(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const email = u?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: cust } = await supabaseAdmin.from("customers").select("id, name, email").ilike("email", email).single();
  return cust || null;
}

// Returns the customer's saved cart so it can be restored after they return
// from an abandoned-cart email.
export async function GET(req: NextRequest) {
  try {
    const cust = await customerFromToken(req);
    if (!cust) return NextResponse.json({ items: [] });
    const { data: cart } = await supabaseAdmin.from("carts").select("items").eq("customer_id", cust.id).single();
    return NextResponse.json({ items: cart?.items || [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

// Persists the logged-in customer's live cart so abandoned ones can be
// recovered. Empty cart => row removed. Token-verified, scoped to the customer.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: cust } = await supabaseAdmin.from("customers").select("id, name, email").ilike("email", email).single();
    if (!cust) return NextResponse.json({ ok: true }); // affiliates/admins have no cart

    const { items } = await req.json();
    const list = Array.isArray(items) ? items : [];

    if (list.length === 0) {
      await supabaseAdmin.from("carts").delete().eq("customer_id", cust.id);
      return NextResponse.json({ ok: true, cleared: true });
    }

    await supabaseAdmin.from("carts").upsert(
      { customer_id: cust.id, customer_email: cust.email, customer_name: cust.name, items: list, updated_at: new Date().toISOString(), recovery_sent_at: null },
      { onConflict: "customer_id" }
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("cart/save error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
