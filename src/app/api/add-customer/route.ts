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
    const { name, email, phone, business, address, city, type } = await req.json();

    if (!name || !email || !business || !city || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate a temporary password
    const tempPassword = "A10-" + Math.random().toString(36).slice(2, 10);

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return NextResponse.json({ error: "This email already has an account." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Create customer record
    const { error: custError } = await supabaseAdmin.from("customers").insert({
      user_id: authUser.user.id,
      name,
      email,
      business,
      city,
      type,
      status: "active",
    });

    if (custError) {
      return NextResponse.json({ error: "Failed to create customer: " + custError.message }, { status: 500 });
    }

    // Send welcome email with login credentials
    await sendEmail(
      email,
      "Welcome to Active 10 Wholesale! Your Account is Ready",
      `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#0072BC">Welcome to Active 10 Wholesale!</h2>
        <p>Hi ${name},</p>
        <p>Your wholesale account has been created! You can now access our wholesale portal and start ordering at exclusive wholesale pricing.</p>

        <div style="background:#f5f8fa;border:1px solid #e1e8ed;border-radius:12px;padding:24px;margin:24px 0">
          <h3 style="margin:0 0 16px 0;color:#333">Your Login Credentials</h3>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px 0;font-weight:bold;color:#555;width:120px">Portal URL</td><td style="padding:8px 0"><a href="https://wholesale.getactive10.com" style="color:#0072BC">wholesale.getactive10.com</a></td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;color:#555">Email</td><td style="padding:8px 0">${email}</td></tr>
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

    return NextResponse.json({ ok: true, email });
  } catch (err: any) {
    console.error("Add customer error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
