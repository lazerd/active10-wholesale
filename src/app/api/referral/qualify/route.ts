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
  // Exact case-insensitive match, not ilike: PostgREST does not honor escaped
  // LIKE wildcards, so an account whose address contains "_" (legal in an email)
  // would pattern-match an admin row and inherit admin on this route.
  const { data: admins } = await supabaseAdmin.from("admin_emails").select("email");
  const ad = (admins || []).some((r: { email: string | null }) => (r.email || "").toLowerCase() === email);
  return !!ad;
}

// Called after an order is marked confirmed. Grants the referrer's credit if eligible.
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    const result = await grantReferralForOrder(supabaseAdmin, orderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("referral/qualify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
