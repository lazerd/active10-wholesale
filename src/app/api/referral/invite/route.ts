import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";

const slugify = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 12) || "ref";

function inviteEmail(referrerName: string, referrerBusiness: string, link: string) {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;"><span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span></div>
        <h1 style="color:#fff;margin:0;font-size:23px;font-weight:800;">You've been invited to Active 10 Wholesale</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 18px;"><strong>${referrerName}</strong>${referrerBusiness ? ` from ${referrerBusiness}` : ""} thought your practice would love Active 10's wholesale program — and set you up with a welcome offer:</p>
        <div style="background:#f0f7ff;border:2px dashed #0072BC;border-radius:12px;padding:22px;text-align:center;margin-bottom:20px;">
          <div style="font-size:26px;font-weight:900;color:#0072BC;line-height:1.2;">20% OFF + FREE SHIPPING</div>
          <div style="font-size:14px;color:#0072BC;font-weight:600;margin-top:6px;">plus 25 FREE sample packets</div>
          <div style="font-size:12px;color:#7a9bb5;margin-top:8px;">on your first order of $100 or more</div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="background:#0072BC;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">Claim Your Welcome Offer</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;line-height:1.6;">Active 10 makes professional-grade CBD &amp; topical pain-relief products for healthcare practices. Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
      </div>
      <div style="background:#f4f7fc;padding:16px 32px;text-align:center;border-top:1px solid #e8f0fe;"><p style="margin:0;font-size:11px;color:#aaa;">Active Formulations Inc. · wholesale.getactive10.com</p></div>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    const myEmail = u?.user?.email?.toLowerCase();
    if (!myEmail) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: me } = await supabaseAdmin.from("customers").select("*").ilike("email", myEmail).single();
    if (!me) return NextResponse.json({ error: "No customer" }, { status: 403 });

    const { name, email } = await req.json();
    const refEmail = String(email || "").trim().toLowerCase();
    if (!refEmail || !/.+@.+\..+/.test(refEmail)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    if (refEmail === myEmail) return NextResponse.json({ error: "You can't refer yourself." }, { status: 400 });

    // Must be genuinely new: no existing customer, application, or prior referral.
    const { data: existCust } = await supabaseAdmin.from("customers").select("id").ilike("email", refEmail).limit(1);
    if (existCust && existCust.length) return NextResponse.json({ error: "That practice is already an Active 10 customer." }, { status: 400 });
    const { data: existApp } = await supabaseAdmin.from("applications").select("id").ilike("email", refEmail).limit(1);
    if (existApp && existApp.length) return NextResponse.json({ error: "That practice has already applied." }, { status: 400 });
    const { data: existRef } = await supabaseAdmin.from("referrals").select("id, status").ilike("referred_email", refEmail).neq("status", "expired").limit(1);
    if (existRef && existRef.length) return NextResponse.json({ error: "That colleague has already been invited." }, { status: 400 });

    // Ensure I have a referral code
    let code = me.referral_code;
    if (!code) {
      code = `${slugify(me.name)}-${Math.random().toString(36).slice(2, 6)}`;
      await supabaseAdmin.from("customers").update({ referral_code: code }).eq("id", me.id);
    }

    await supabaseAdmin.from("referrals").insert({ referrer_customer_id: me.id, referred_email: refEmail, referred_name: name || null, status: "invited", reward_amount: 100 });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to: refEmail, subject: `${me.name.split(" ")[0]} invited you to Active 10 Wholesale — 20% off + free shipping`, html: inviteEmail(me.name, me.business, `${SITE}/invite/${code}`) }),
    });
    if (!res.ok) return NextResponse.json({ error: "Invite couldn't be emailed. Try again." }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("referral/invite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
