import { NextResponse } from "next/server";
import { GMAIL_REDIRECT, GMAIL_SCOPES } from "@/lib/gmail";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect("https://wholesale.getactive10.com?gmail_error=not_configured");
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(GMAIL_REDIRECT)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(GMAIL_SCOPES.join(" "))}` +
    `&access_type=offline&prompt=consent` +
    `&state=${crypto.randomUUID()}`;
  return NextResponse.redirect(url);
}
