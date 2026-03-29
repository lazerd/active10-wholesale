import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.QB_CLIENT_ID!;
  const redirectUri = process.env.QB_REDIRECT_URI!;
  const scope = "com.intuit.quickbooks.accounting";
  const state = crypto.randomUUID();

  const authUrl =
    `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  return NextResponse.redirect(authUrl);
}
