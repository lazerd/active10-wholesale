import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Affiliate, eligibleOrders, isPayable, orderCommission, round2 } from "@/lib/affiliate";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";

async function sendEmail(to: string, subject: string, html: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to, subject, html }),
  });
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

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();
    const action = body.action;

    if (action === "list") {
      const { data: affs } = await supabaseAdmin.from("affiliates").select("*").order("created_at", { ascending: false });
      const affiliates = (affs || []) as Affiliate[];
      const { data: custs } = await supabaseAdmin
        .from("customers")
        .select("id, name, business, affiliate_id, created_at")
        .not("affiliate_id", "is", null);
      const customers = custs || [];
      const ids = customers.map((c) => c.id);
      const { data: ords } = ids.length
        ? await supabaseAdmin.from("orders").select("id, customer_id, subtotal, total, status, created_at").in("customer_id", ids)
        : { data: [] as any[] };
      const orders = ords || [];
      const { data: payouts } = await supabaseAdmin.from("affiliate_payouts").select("affiliate_id, amount");
      const pay = payouts || [];

      const result = affiliates.map((a) => {
        const myC = customers.filter((c) => c.affiliate_id === a.id);
        let payable = 0,
          pending = 0;
        for (const c of myC) {
          const cO = orders.filter((o) => o.customer_id === c.id);
          for (const o of eligibleOrders(cO as any, c as any, a)) {
            const comm = orderCommission(o as any, a);
            if (isPayable(o.status)) payable += comm;
            else pending += comm;
          }
        }
        const paidOut = pay.filter((p) => p.affiliate_id === a.id).reduce((s, p) => s + Number(p.amount), 0);
        return {
          ...a,
          referredCount: myC.length,
          payableEarned: round2(payable),
          pendingEarned: round2(pending),
          paidOut: round2(paidOut),
          owed: round2(Math.max(0, payable - paidOut)),
        };
      });
      return NextResponse.json({ ok: true, affiliates: result });
    }

    if (action === "create") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const slug = slugify(body.slug || body.name || "");
      const rate = body.commission_rate != null ? Number(body.commission_rate) : 0.15;
      const rule = body.commission_rule || "lifetime";
      const base = body.commission_base || "subtotal";
      if (!name || !email || !slug) return NextResponse.json({ error: "Name, email, and slug are required." }, { status: 400 });

      const { data: dupe } = await supabaseAdmin.from("affiliates").select("id").or(`email.eq.${email},slug.eq.${slug}`).limit(1);
      if (dupe && dupe.length) return NextResponse.json({ error: "An affiliate with that email or referral code already exists." }, { status: 400 });

      // Create (or reuse) an auth login for the affiliate
      const tempPassword = "A10aff-" + Math.random().toString(36).slice(2, 10);
      let userId: string | null = null;
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
      if (authErr && !authErr.message.includes("already been registered")) {
        return NextResponse.json({ error: authErr.message }, { status: 500 });
      }
      userId = authUser?.user?.id || null;
      const newAccount = !!authUser?.user?.id;

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("affiliates")
        .insert({ user_id: userId, name, email, slug, commission_rate: rate, commission_rule: rule, commission_base: base, status: "active" })
        .select()
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      const refUrl = `${SITE}/r/${slug}`;
      await sendEmail(
        email,
        "You're an Active 10 Affiliate — your referral portal is ready",
        `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">Welcome to the Active 10 Affiliate Program!</h2>
          <p>Hi ${name},</p>
          <p>You're all set up as an Active 10 affiliate. Share your personal link and you'll earn <strong>${Math.round(rate * 100)}% commission</strong> on the practices you refer.</p>
          <div style="background:#f5f8fa;border:1px solid #e1e8ed;border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0 0 6px;font-weight:bold;color:#555">Your referral link</p>
            <p style="margin:0 0 16px"><a href="${refUrl}" style="color:#0072BC;font-size:16px">${refUrl}</a></p>
            <p style="margin:0 0 6px;font-weight:bold;color:#555">Your affiliate portal login</p>
            <table style="border-collapse:collapse">
              <tr><td style="padding:4px 0;color:#555;width:100px">Portal</td><td style="padding:4px 0"><a href="${SITE}" style="color:#0072BC">wholesale.getactive10.com</a></td></tr>
              <tr><td style="padding:4px 0;color:#555">Email</td><td style="padding:4px 0">${email}</td></tr>
              ${newAccount ? `<tr><td style="padding:4px 0;color:#555">Temp Password</td><td style="padding:4px 0;font-family:monospace;color:#0072BC">${tempPassword}</td></tr>` : `<tr><td style="padding:4px 0;color:#555">Password</td><td style="padding:4px 0">Use your existing account password</td></tr>`}
            </table>
          </div>
          <p>Log in any time to grab your QR code and track your referrals and commissions.</p>
          <p style="margin-top:24px;color:#666">Questions? Reply to this email or contact activeformulations@gmail.com.</p>
        </div>
        `
      );

      return NextResponse.json({ ok: true, affiliate: inserted });
    }

    if (action === "update") {
      const { id, commission_rate, commission_rule, commission_base, status } = body;
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      const updates: Record<string, any> = {};
      if (commission_rate != null) updates.commission_rate = Number(commission_rate);
      if (commission_rule) updates.commission_rule = commission_rule;
      if (commission_base) updates.commission_base = commission_base;
      if (status) updates.status = status;
      const { error } = await supabaseAdmin.from("affiliates").update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "payout") {
      const { affiliate_id, amount, note } = body;
      if (!affiliate_id || !amount) return NextResponse.json({ error: "Missing affiliate or amount" }, { status: 400 });
      const { error } = await supabaseAdmin.from("affiliate_payouts").insert({ affiliate_id, amount: Number(amount), note: note || null });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      // Unlink referred customers, then delete the affiliate (payouts cascade).
      await supabaseAdmin.from("customers").update({ affiliate_id: null }).eq("affiliate_id", id);
      const { error } = await supabaseAdmin.from("affiliates").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("affiliate/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
