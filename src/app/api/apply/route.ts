import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { captchaToken, ...rec } = await req.json();

    // Verify the Cloudflare Turnstile token. Skipped only when no secret is
    // configured yet, so the form keeps working before keys are added in Vercel.
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

    if (!rec.email || !rec.name || !rec.business) {
      return NextResponse.json({ ok: false, error: "Please fill in your name, practice name, and email." }, { status: 400 });
    }

    // Whitelist the columns we accept — never trust the client payload wholesale.
    const insert: Record<string, unknown> = {
      name: rec.name,
      email: rec.email,
      phone: rec.phone || null,
      business: rec.business,
      address: rec.address || null,
      city: rec.city || null,
      state: rec.state || null,
      zip: rec.zip || null,
      type: rec.type || null,
    };
    if (rec.affiliate_slug) insert.affiliate_slug = String(rec.affiliate_slug).toLowerCase();
    if (rec.referred_by_code) insert.referred_by_code = String(rec.referred_by_code).toLowerCase();

    const { error } = await supabaseAdmin.from("applications").insert(insert);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}
