import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { balances } from "@/lib/credit";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SITE = "https://wholesale.getactive10.com";

const slugify = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 12) || "ref";

async function ensureCode(cust: any): Promise<string> {
  if (cust.referral_code) return cust.referral_code;
  for (let i = 0; i < 8; i++) {
    const code = `${slugify(cust.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: dupe } = await supabaseAdmin.from("customers").select("id").eq("referral_code", code).limit(1);
    if (!dupe || !dupe.length) {
      await supabaseAdmin.from("customers").update({ referral_code: code }).eq("id", cust.id);
      return code;
    }
  }
  const fallback = "ref-" + cust.id.slice(0, 8);
  await supabaseAdmin.from("customers").update({ referral_code: fallback }).eq("id", cust.id);
  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: cust } = await supabaseAdmin.from("customers").select("*").ilike("email", email).single();
    if (!cust) return NextResponse.json({ error: "No customer" }, { status: 403 });

    const code = await ensureCode(cust);
    const { data: creditRows } = await supabaseAdmin.from("customer_credits").select("amount, kind, status, expires_at").eq("customer_id", cust.id);
    const bal = balances(creditRows || []);
    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("referred_email, referred_name, status, reward_amount, created_at")
      .eq("referrer_customer_id", cust.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      referralCode: code,
      referralUrl: `${SITE}/invite/${code}`,
      balance: bal,
      referrals: (refs || []).map((r) => ({ email: r.referred_email, name: r.referred_name, status: r.status, reward: Number(r.reward_amount) })),
    });
  } catch (err: any) {
    console.error("referral/my error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
