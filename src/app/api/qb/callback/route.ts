import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.redirect(
      `https://wholesale.getactive10.com?qb_error=missing_params`
    );
  }

  try {
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
        ).toString("base64")}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QB_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("QB token exchange failed:", err);
      return NextResponse.redirect(
        `https://wholesale.getactive10.com?qb_error=token_exchange`
      );
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: dbError } = await supabase.from("qb_tokens").upsert({
      id: "default",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      realm_id: realmId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("Failed to store QB tokens:", dbError);
      return NextResponse.redirect(
        `https://wholesale.getactive10.com?qb_error=db_store`
      );
    }

    return NextResponse.redirect(
      `https://wholesale.getactive10.com?qb_connected=true`
    );
  } catch (err) {
    console.error("QB callback error:", err);
    return NextResponse.redirect(
      `https://wholesale.getactive10.com?qb_error=unknown`
    );
  }
}
