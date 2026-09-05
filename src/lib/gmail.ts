import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const SITE = "https://wholesale.getactive10.com";
export const GMAIL_REDIRECT = `${SITE}/api/gmail/callback`;
// gmail.compose is what allows drafts.create — gmail.send only sends, it cannot
// put anything in the Drafts folder. Adding it means the existing refresh token
// is under-scoped: Gmail must be RECONNECTED once from the admin screen before
// draft creation works.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// Returns a valid access token, refreshing if needed. null if not connected.
export async function getGmailAccess(): Promise<string | null> {
  const { data } = await supabase.from("gmail_tokens").select("*").eq("id", "default").single();
  if (!data || !data.refresh_token) return null;

  if (data.access_token && data.expires_at && new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return data.access_token;
  }
  // Refresh
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Gmail token refresh failed:", errText);
    // The refresh token is dead (expired/revoked — e.g. a "Testing" OAuth app
    // expires them after 7 days). Clear it so the UI correctly shows "not
    // connected" and surfaces the Connect button again, instead of a misleading
    // green "connected" state that can never actually send.
    if (errText.includes("invalid_grant")) {
      await supabase.from("gmail_tokens").update({ refresh_token: null, access_token: null }).eq("id", "default");
    }
    return null;
  }
  const t = await res.json();
  await supabase.from("gmail_tokens").update({
    access_token: t.access_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", "default");
  return t.access_token;
}

function base64url(s: string) {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Sends a plain-text email from the connected Gmail account. Returns true on success.
export async function gmailSend(accessToken: string, to: string, subject: string, body: string): Promise<boolean> {
  const raw = base64url(
    [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
  );
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) console.error("Gmail send failed:", await res.text());
  return res.ok;
}

// Returns the set of email addresses (lowercased) that have sent us a message in
// the last `days`, restricted to the provided candidate addresses.
export async function gmailRepliesFrom(accessToken: string, emails: string[], days = 60): Promise<Set<string>> {
  const replied = new Set<string>();
  const targets = emails.map((e) => e.toLowerCase());
  // Chunk the OR query to keep it short.
  for (let i = 0; i < targets.length; i += 15) {
    const chunk = targets.slice(i, i + 15);
    const q = `(${chunk.map((e) => `from:${e}`).join(" OR ")}) newer_than:${days}d`;
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) continue;
    const list = await listRes.json();
    for (const m of list.messages || []) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const from = (msg.payload?.headers || []).find((h: any) => h.name === "From")?.value || "";
      const m2 = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (m2) { const addr = m2[0].toLowerCase(); if (targets.includes(addr)) replied.add(addr); }
    }
  }
  return replied;
}

/**
 * Creates a real Gmail DRAFT in the connected account, so it can be reviewed
 * and sent from Gmail itself rather than from the portal.
 *
 * Needs the gmail.compose scope. Returns the draft id, or null with the reason
 * logged — an under-scoped token fails here with 403 insufficientPermissions,
 * which means Gmail was connected before compose was added and needs
 * reconnecting.
 */
export async function gmailCreateDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<string | null> {
  const raw = base64url(
    [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
  );
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    console.error("Gmail draft create failed:", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json?.id || null;
}

/**
 * Recipient+subject pairs that already have a Gmail draft, so a second run
 * cannot leave two identical drafts sitting in the folder. `outreach_touches`
 * has nowhere to record a Gmail draft id, so Gmail itself is the record.
 */
export async function gmailExistingDraftKeys(accessToken: string): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=500", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok) return keys;
    const { drafts } = await list.json();
    for (const d of drafts || []) {
      const m = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${d.id}?format=metadata`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!m.ok) continue;
      const j = await m.json();
      const hs = j?.message?.payload?.headers || [];
      const to = (hs.find((h: any) => h.name?.toLowerCase() === "to")?.value || "").toLowerCase();
      const subj = (hs.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "").toLowerCase();
      const addr = (to.match(/[^\s<>,]+@[^\s<>,]+/) || [""])[0];
      if (addr) keys.add(addr + "|" + subj);
    }
  } catch (e) {
    console.error("gmailExistingDraftKeys:", e);
  }
  return keys;
}
