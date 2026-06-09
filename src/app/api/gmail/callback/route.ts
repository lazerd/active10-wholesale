import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GMAIL_REDIRECT, SITE } from "@/lib/gmail";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(`${SITE}?gmail_error=missing_code`);
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: GMAIL_REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      console.error("Gmail token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${SITE}?gmail_error=token_exchange`);
    }
    const t = await tokenRes.json();

    // Get the connected account's email
    let email = "";
    try {
      const prof = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (prof.ok) email = (await prof.json()).emailAddress || "";
    } catch {}

    const row: any = {
      id: "default",
      access_token: t.access_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      email,
      updated_at: new Date().toISOString(),
    };
    if (t.refresh_token) row.refresh_token = t.refresh_token; // only present on first consent
    await supabase.from("gmail_tokens").upsert(row);

    return NextResponse.redirect(`${SITE}?gmail_connected=true`);
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(`${SITE}?gmail_error=unknown`);
  }
}
