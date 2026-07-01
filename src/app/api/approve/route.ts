import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

async function sendEmail(to: string, subject: string, html: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Active 10 Wholesale <notifications@getactive10.com>",
      to,
      subject,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { applicationId, action } = await req.json();

    if (!applicationId || !action) {
      return NextResponse.json({ error: "Missing applicationId or action" }, { status: 400 });
    }

    // Get the application
    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (action === "reject") {
      await supabaseAdmin.from("applications").update({ status: "rejected" }).eq("id", applicationId);

      // Send rejection email
      await sendEmail(
        app.email,
        "Active 10 Wholesale — Application Update",
        `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">Active 10 Wholesale</h2>
          <p>Hi ${app.name},</p>
          <p>Thank you for your interest in becoming an Active 10 wholesale partner. After reviewing your application, we're unable to approve your account at this time.</p>
          <p>If you have questions or would like to discuss further, please reply to this email or contact us at activeformulations@gmail.com.</p>
          <p style="margin-top:24px">Best regards,<br>Active 10 Wholesale Team</p>
        </div>
        `
      );

      return NextResponse.json({ ok: true, action: "rejected" });
    }

    if (action === "approve") {
      // Generate a temporary password
      const tempPassword = "A10-" + Math.random().toString(36).slice(2, 10);

      // Create auth user — or reuse an existing one (re-application, prior
      // sample/affiliate signup, etc.) by resetting them a fresh temp password.
      // The credentials only ever go to the applicant's own email, so this is safe.
      let userId: string;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: app.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError) {
        if (!authError.message.includes("already been registered")) {
          return NextResponse.json({ error: authError.message }, { status: 500 });
        }
        // Find the existing auth user by email
        let existing: { id: string } | undefined;
        for (let page = 1; page <= 20 && !existing; page++) {
          const { data: pageData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) return NextResponse.json({ error: "Lookup failed: " + listErr.message }, { status: 500 });
          existing = pageData.users.find((u) => (u.email || "").toLowerCase() === String(app.email).toLowerCase());
          if (pageData.users.length < 200) break;
        }
        if (!existing) {
          return NextResponse.json({ error: "This email already has an account, but it couldn't be found to reset. Contact support." }, { status: 500 });
        }
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: tempPassword, email_confirm: true });
        if (updErr) return NextResponse.json({ error: "Password reset failed: " + updErr.message }, { status: 500 });
        userId = existing.id;
      } else {
        userId = authUser.user.id;
      }

      // If this applicant came in through an affiliate referral link, credit them.
      let affiliateId: string | null = null;
      if (app.affiliate_slug) {
        const { data: aff } = await supabaseAdmin
          .from("affiliates")
          .select("id, status")
          .eq("slug", String(app.affiliate_slug).toLowerCase())
          .single();
        if (aff && aff.status === "active") affiliateId = aff.id;
      }

      // Create the customer record — or reactivate/relink an existing one for
      // the same email so re-approvals don't fail on duplicates.
      const { data: existingCust } = await supabaseAdmin.from("customers").select("id").ilike("email", app.email).limit(1).maybeSingle();
      const custFields = {
        user_id: userId,
        name: app.name,
        email: app.email,
        phone: app.phone || null,
        business: app.business,
        address: app.address || null,
        city: app.city,
        state: app.state || null,
        zip: app.zip || null,
        type: app.type,
        status: "active",
      };
      const { error: custError } = existingCust
        ? await supabaseAdmin
            .from("customers")
            .update(affiliateId ? { ...custFields, affiliate_id: affiliateId } : custFields)
            .eq("id", existingCust.id)
        : await supabaseAdmin.from("customers").insert({ ...custFields, affiliate_id: affiliateId });

      if (custError) {
        return NextResponse.json({ error: "Failed to create customer: " + custError.message }, { status: 500 });
      }

      // Update application status
      await supabaseAdmin.from("applications").update({ status: "approved" }).eq("id", applicationId);

      // If this approved customer was one of our outreach prospects, mark it won
      // (best-effort; never blocks the approval). Powers the funnel's won count.
      try {
        await supabaseAdmin.from("outreach_prospects").update({ status: "won" }).ilike("email", app.email).neq("status", "won");
      } catch (e) { console.error("outreach won-attribution:", e); }

      // ── Customer referral: link the new practice to its referrer, mark the
      // referral "joined", and create their welcome offer (20% + free shipping
      // + 25 sample packets) as a reusable winback_offers row.
      let referralWelcome: { code: string } | null = null;
      if (app.referred_by_code) {
        const { data: referrer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("referral_code", String(app.referred_by_code).toLowerCase())
          .single();
        const { data: newCust } = await supabaseAdmin.from("customers").select("id").eq("email", app.email).single();
        if (referrer && newCust) {
          await supabaseAdmin.from("customers").update({ referred_by_customer_id: referrer.id }).eq("id", newCust.id);
          // Attach to the existing invite (by email) or create a referral record.
          const { data: existing } = await supabaseAdmin.from("referrals").select("id").eq("referrer_customer_id", referrer.id).ilike("referred_email", app.email).neq("status", "expired").limit(1).single();
          if (existing) {
            await supabaseAdmin.from("referrals").update({ status: "joined", referred_customer_id: newCust.id, joined_at: new Date().toISOString() }).eq("id", existing.id);
          } else {
            await supabaseAdmin.from("referrals").insert({ referrer_customer_id: referrer.id, referred_email: app.email, referred_name: app.name, referred_customer_id: newCust.id, status: "joined", reward_amount: 100, joined_at: new Date().toISOString() });
          }
          // Welcome offer redeemable through the existing discount-code engine.
          const welcomeCode = "WELCOME" + Math.random().toString(36).slice(2, 7).toUpperCase();
          const expires = new Date(Date.now() + 30 * 86400000);
          await supabaseAdmin.from("winback_offers").insert({ customer_id: newCust.id, customer_email: app.email, code: welcomeCode, discount_pct: 0.2, free_shipping: true, sample_packets: 25, kind: "referral_welcome", status: "sent", subject: "Welcome offer", reason: "Referral welcome", expires_at: expires.toISOString() });
          referralWelcome = { code: welcomeCode };
        }
      }

      // Send welcome email with login credentials
      await sendEmail(
        app.email,
        "Welcome to Active 10 Wholesale! Your Account is Ready",
        `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">Welcome to Active 10 Wholesale!</h2>
          <p>Hi ${app.name},</p>
          <p>Great news — your wholesale application has been approved! You can now access our wholesale portal and start ordering at exclusive wholesale pricing.</p>
          ${referralWelcome ? `<div style="background:#f0f7ff;border:2px dashed #0072BC;border-radius:12px;padding:20px;text-align:center;margin:20px 0;"><div style="font-size:20px;font-weight:900;color:#0072BC;">Your Welcome Gift 🎁</div><div style="font-size:14px;color:#0072BC;font-weight:600;margin-top:6px;">20% off + free shipping + 25 free sample packets</div><div style="font-size:12px;color:#888;margin-top:6px;">on your first order of $100 or more</div><div style="margin-top:12px;font-size:13px;color:#666;">Enter this code at checkout:</div><div style="font-size:20px;font-weight:800;letter-spacing:2px;font-family:monospace;color:#1a1a2e;margin-top:4px;">${referralWelcome.code}</div></div>` : ""}

          <div style="background:#f5f8fa;border:1px solid #e1e8ed;border-radius:12px;padding:24px;margin:24px 0">
            <h3 style="margin:0 0 16px 0;color:#333">Your Login Credentials</h3>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:8px 0;font-weight:bold;color:#555;width:120px">Portal URL</td><td style="padding:8px 0"><a href="https://wholesale.getactive10.com" style="color:#0072BC">wholesale.getactive10.com</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#555">Email</td><td style="padding:8px 0">${app.email}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#555">Temp Password</td><td style="padding:8px 0;font-family:monospace;font-size:16px;color:#0072BC">${tempPassword}</td></tr>
            </table>
          </div>

          <p style="color:#888;font-size:13px">We recommend changing your password after your first login.</p>
          
          <p style="margin-top:24px">
            <a href="https://wholesale.getactive10.com" style="background:#0072BC;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Start Shopping</a>
          </p>
          
          <p style="margin-top:32px;color:#666">Questions? Reply to this email or contact us at activeformulations@gmail.com.</p>
          <p style="color:#666">Best regards,<br>Active 10 Wholesale Team</p>
        </div>
        `
      );

      return NextResponse.json({ ok: true, action: "approved", email: app.email });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
