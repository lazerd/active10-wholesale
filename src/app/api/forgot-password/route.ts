import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Self-serve "forgot password". Supabase's own auth mailer fails here with
// "Error sending recovery email" (reproduced 2026-10-06 for a real customer),
// so we mint the recovery link ourselves and send it through Resend, which
// every other portal email already uses. The link signs them in and the page
// opens Change Password on the PASSWORD_RECOVERY event.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE = "https://wholesale.getactive10.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { email: raw } = await req.json().catch(() => ({ email: "" }));
  const email = String(raw || "").trim().toLowerCase();
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });

  // Same answer whether or not the address has an account, so this can't be
  // used to find out who our customers are.
  const ok = NextResponse.json({ ok: true });

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: SITE },
  });
  const link = data?.properties?.action_link;
  if (error || !link) return ok;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Active 10 Wholesale <notifications@getactive10.com>",
      to: email,
      subject: "Reset your Active 10 Wholesale password",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1a1a2e;">
        <p>We got a request to reset your Active 10 Wholesale password.</p>
        <p><a href="${link}" style="display:inline-block;background:#0072BC;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Choose a new password</a></p>
        <p style="color:#666;font-size:13px;">The link signs you in and opens the Change Password box. It works once and expires in an hour. If you didn't ask for this, you can ignore this email.</p>
      </div>`,
    }),
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: "Couldn't send the email. Please try again in a minute." }, { status: 502 });
  return ok;
}
