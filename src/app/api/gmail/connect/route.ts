import { NextResponse } from "next/server";
import { GMAIL_REDIRECT, GMAIL_SCOPES } from "@/lib/gmail";

// Required: a static prerender would bake one state UUID into every redirect.
export const dynamic = "force-dynamic";

// ?account=personal connects Darrin's own inbox (darrinjco@gmail.com) for the
// local email-to-Claude poller. It is stored as gmail_tokens row "personal" and
// never touches the "default" (activeformulations@) row the portal sends from.
const PERSONAL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect("https://wholesale.getactive10.com?gmail_error=not_configured");
  if (new URL(req.url).searchParams.get("account") === "personal") {
    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(GMAIL_REDIRECT)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(PERSONAL_SCOPES.join(" "))}` +
      `&access_type=offline&prompt=consent` +
      `&login_hint=${encodeURIComponent("darrinjco@gmail.com")}` +
      `&state=personal.${crypto.randomUUID()}`);
  }
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
