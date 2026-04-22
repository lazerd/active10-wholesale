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

      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: app.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError) {
        // User might already exist
        if (authError.message.includes("already been registered")) {
          return NextResponse.json({ error: "This email already has an account." }, { status: 400 });
        }
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      // Create customer record
      const { error: custError } = await supabaseAdmin.from("customers").insert({
        user_id: authUser.user.id,
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
      });

      if (custError) {
        return NextResponse.json({ error: "Failed to create customer: " + custError.message }, { status: 500 });
      }

      // Update application status
      await supabaseAdmin.from("applications").update({ status: "approved" }).eq("id", applicationId);

      // Send welcome email with login credentials
      await sendEmail(
        app.email,
        "Welcome to Active 10 Wholesale! Your Account is Ready",
        `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">Welcome to Active 10 Wholesale!</h2>
          <p>Hi ${app.name},</p>
          <p>Great news — your wholesale application has been approved! You can now access our wholesale portal and start ordering at exclusive wholesale pricing.</p>
          
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
