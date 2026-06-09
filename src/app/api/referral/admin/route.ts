import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantReferralForOrder } from "@/lib/referralGrant";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";

function announceEmail(name: string) {
  const first = (name || "there").split(" ")[0];
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;"><span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span></div>
        <h1 style="color:#fff;margin:0;font-size:23px;font-weight:800;">Refer a practice, earn $100</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#1a1a2e;font-size:15px;margin:0 0 16px;">Hi ${first},</p>
        <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 18px;">We just launched a referral program — and as a valued Active 10 wholesale partner, you're the first to know.</p>
        <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 8px;">Know another practice that would love Active 10? Refer them and:</p>
        <ul style="color:#444;font-size:14px;line-height:1.8;margin:0 0 20px;padding-left:20px;">
          <li><strong>They get</strong> 20% off + free shipping + 25 free sample packets on their first order ($100+)</li>
          <li><strong>You get</strong> $100 in account credit once their first order is confirmed</li>
        </ul>
        <div style="text-align:center;margin:24px 0;">
          <a href="${SITE}" style="background:#0072BC;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">Start Referring</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:20px;line-height:1.6;">Just log in and click "Refer &amp; Earn" at the top of the portal to grab your personal link and QR code. Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
      </div>
      <div style="background:#f4f7fc;padding:16px 32px;text-align:center;border-top:1px solid #e8f0fe;"><p style="margin:0;font-size:11px;color:#aaa;">Active Formulations Inc. · wholesale.getactive10.com</p></div>
    </div>
  </div>`;
}

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

    if (action === "announce") {
      const { data: actives } = await supabaseAdmin.from("customers").select("id, name, email").eq("status", "active");
      const { data: sentRows } = await supabaseAdmin.from("referral_announcements").select("customer_id");
      const already = new Set((sentRows || []).map((r) => r.customer_id));
      const pending = (actives || []).filter((c) => c.email && !already.has(c.id));
      let sent = 0;
      for (const c of pending) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to: c.email, subject: "New: refer a practice, earn $100 in credit", html: announceEmail(c.name) }),
        });
        if (res.ok) { await supabaseAdmin.from("referral_announcements").upsert({ customer_id: c.id }, { onConflict: "customer_id" }); sent++; }
      }
      return NextResponse.json({ ok: true, sent });
    }

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
    const { data: actives } = await supabaseAdmin.from("customers").select("id").eq("status", "active");
    const { data: sentRows } = await supabaseAdmin.from("referral_announcements").select("customer_id");
    const announcedSet = new Set((sentRows || []).map((r) => r.customer_id));
    const announce = { activeCustomers: (actives || []).length, announced: announcedSet.size, pending: (actives || []).filter((c) => !announcedSet.has(c.id)).length };
    return NextResponse.json({ ok: true, referrals: rows, summary, announce });
  } catch (err: any) {
    console.error("referral/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
