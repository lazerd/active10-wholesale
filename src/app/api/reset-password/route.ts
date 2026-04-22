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
    const { customerId } = await req.json();
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customerId" }, { status: 400 });
    }

    const { data: customer, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, name, email")
      .eq("id", customerId)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
    }
    if (!customer.user_id) {
      return NextResponse.json({ ok: false, error: "Customer has no login account" }, { status: 400 });
    }

    const tempPassword = "A10-" + Math.random().toString(36).slice(2, 10);

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(customer.user_id, {
      password: tempPassword,
    });

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    const emailRes = await sendEmail(
      customer.email,
      "Your Active 10 Wholesale Password Has Been Reset",
      `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#0072BC">Your Password Has Been Reset</h2>
        <p>Hi ${customer.name},</p>
        <p>An administrator has reset your Active 10 Wholesale account password. Use the temporary password below to sign in.</p>

        <div style="background:#f5f8fa;border:1px solid #e1e8ed;border-radius:12px;padding:24px;margin:24px 0">
          <h3 style="margin:0 0 16px 0;color:#333">Your New Login Credentials</h3>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px 0;font-weight:bold;color:#555;width:120px">Portal URL</td><td style="padding:8px 0"><a href="https://wholesale.getactive10.com" style="color:#0072BC">wholesale.getactive10.com</a></td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;color:#555">Email</td><td style="padding:8px 0">${customer.email}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;color:#555">Temp Password</td><td style="padding:8px 0;font-family:monospace;font-size:16px;color:#0072BC">${tempPassword}</td></tr>
          </table>
        </div>

        <p style="color:#888;font-size:13px">For security, please change your password after signing in.</p>

        <p style="margin-top:24px">
          <a href="https://wholesale.getactive10.com" style="background:#0072BC;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Sign In</a>
        </p>

        <p style="margin-top:32px;color:#666">If you didn't expect this email, contact us at activeformulations@gmail.com.</p>
        <p style="color:#666">Best regards,<br>Active 10 Wholesale Team</p>
      </div>
      `
    );

    if (!emailRes.ok) {
      const body = await emailRes.text().catch(() => "");
      return NextResponse.json({ ok: false, error: "Password reset, but email failed to send: " + body }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email: customer.email });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
