import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

// Who gets told to ship a sample.
const NOTIFY_EMAILS = ["darrinjco@gmail.com", "activeformulationorders@gmail.com"];

async function notify(rec: Record<string, string>) {
  if (!RESEND_API_KEY) return;
  const addr = [rec.address, [rec.city, rec.state].filter(Boolean).join(", "), rec.zip].filter(Boolean).join(" · ");
  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#0072BC">📦 New Free-Sample Request</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee;width:130px">Practice</td><td style="padding:10px;border-bottom:1px solid #eee">${rec.business || "N/A"}</td></tr>
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Name</td><td style="padding:10px;border-bottom:1px solid #eee">${rec.name || "N/A"}</td></tr>
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:10px;border-bottom:1px solid #eee">${rec.email || "N/A"}</td></tr>
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Phone</td><td style="padding:10px;border-bottom:1px solid #eee">${rec.phone || "N/A"}</td></tr>
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Type</td><td style="padding:10px;border-bottom:1px solid #eee">${rec.type || "N/A"}</td></tr>
        <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Ship to</td><td style="padding:10px;border-bottom:1px solid #eee"><strong>${addr || "N/A"}</strong></td></tr>
      </table>
    </div>`;
  await Promise.all(
    NOTIFY_EMAILS.map((to) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Active 10 <notifications@getactive10.com>", to, subject: `Free sample request: ${rec.business || rec.name || rec.email}`, html }),
      }).catch(() => {})
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const { captchaToken, ...rec } = await req.json();

    // Verify Cloudflare Turnstile (skipped only if no secret configured yet).
    if (TURNSTILE_SECRET) {
      if (!captchaToken) {
        return NextResponse.json({ ok: false, error: "Please complete the verification challenge." }, { status: 400 });
      }
      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
      const form = new URLSearchParams();
      form.append("secret", TURNSTILE_SECRET);
      form.append("response", String(captchaToken));
      if (ip) form.append("remoteip", ip.split(",")[0].trim());
      const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const vd = await vr.json().catch(() => ({ success: false }));
      if (!vd.success) {
        return NextResponse.json({ ok: false, error: "Verification failed. Please try again." }, { status: 400 });
      }
    }

    if (!rec.email || !rec.name || !rec.business || !rec.address) {
      return NextResponse.json({ ok: false, error: "Please fill in your name, practice, email, and shipping address." }, { status: 400 });
    }

    const insert = {
      name: rec.name,
      business: rec.business,
      email: rec.email,
      phone: rec.phone || null,
      address: rec.address,
      city: rec.city || null,
      state: rec.state || null,
      zip: rec.zip || null,
      type: rec.type || null,
    };

    const { error } = await supabaseAdmin.from("sample_requests").insert(insert);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Seed the email-outreach pipeline so Darrin can follow up later. Best-effort —
    // skip if this email is already a prospect/customer (don't block the request).
    try {
      const { data: existing } = await supabaseAdmin.from("outreach_prospects").select("id").ilike("email", rec.email).limit(1).maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("outreach_prospects").insert({
          channel: "email", name: rec.name, business: rec.business, email: rec.email,
          phone: rec.phone || null, city: rec.city || null, type: rec.type || "chiropractor",
          source: "sample_request", status: "prospected",
        });
      }
    } catch {}

    await notify(rec);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}
