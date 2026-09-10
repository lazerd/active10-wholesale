import { encodeMimeHeader } from "@/lib/mimeHeader";

/**
 * Gmail helpers for the growth engine: send (optionally in-thread), and the
 * read-side lookups every send is gated on. Needs only gmail.send +
 * gmail.readonly — the scopes the portal's connection already has.
 */
const G = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gget(token: string, path: string): Promise<any> {
  const r = await fetch(G + path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`gmail ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

export async function listIds(token: string, q: string, max = 100): Promise<string[]> {
  const ids: string[] = [];
  let page = "";
  do {
    const j = await gget(token, `/messages?q=${encodeURIComponent(q)}&maxResults=${Math.min(100, max)}${page ? `&pageToken=${page}` : ""}`);
    for (const m of j.messages || []) ids.push(m.id);
    page = j.nextPageToken || "";
  } while (page && ids.length < max);
  return ids.slice(0, max);
}

export type Meta = { id: string; threadId: string; snippet: string; at: string; h: Record<string, string> };

export async function getMeta(token: string, id: string): Promise<Meta> {
  const hs = ["From", "To", "Subject", "Message-ID", "Date", "List-Unsubscribe", "Precedence", "Auto-Submitted"].map((h) => `metadataHeaders=${h}`).join("&");
  const j = await gget(token, `/messages/${id}?format=metadata&${hs}`);
  const h: Record<string, string> = {};
  for (const x of j.payload?.headers || []) h[x.name.toLowerCase()] = x.value;
  return { id: j.id, threadId: j.threadId, snippet: (j.snippet || "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"'), at: new Date(Number(j.internalDate)).toISOString(), h };
}

/** Plain-text body of a message (for bounce parsing). */
export async function getText(token: string, id: string): Promise<string> {
  const j = await gget(token, `/messages/${id}?format=full`);
  const walk = (p: any): string => {
    if (!p) return "";
    if (p.body?.data && /text\/(plain|html)|message\/delivery-status/.test(p.mimeType || "")) return Buffer.from(p.body.data, "base64").toString("utf8");
    return (p.parts || []).map(walk).join("\n");
  };
  return walk(j.payload);
}

export const addrOf = (s: string) => ((s || "").match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [""])[0].toLowerCase();

/** How many messages we've sent this address in the last `days` days. */
export async function sentCount(token: string, email: string, days: number): Promise<number> {
  const j = await gget(token, `/messages?q=${encodeURIComponent(`in:sent to:${email} newer_than:${days}d`)}&maxResults=5`);
  return (j.messages || []).length;
}

/** The most recent message we sent this address — the thread a follow-up joins. */
export async function latestSentTo(token: string, email: string, days = 120): Promise<Meta | null> {
  const ids = await listIds(token, `in:sent to:${email} newer_than:${days}d`, 1);
  return ids.length ? getMeta(token, ids[0]) : null;
}

/** Did this person write anything in the thread? */
export async function threadHasMessageFrom(token: string, threadId: string, email: string): Promise<boolean> {
  const j = await gget(token, `/threads/${threadId}?format=metadata&metadataHeaders=From`);
  return (j.messages || []).some((m: any) => addrOf((m.payload?.headers || []).find((x: any) => x.name === "From")?.value || "") === email.toLowerCase());
}

/** Every address on From/To across a thread. */
export async function threadAddresses(token: string, threadId: string): Promise<string[]> {
  const j = await gget(token, `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To`);
  const out = new Set<string>();
  for (const m of j.messages || []) {
    for (const h of m.payload?.headers || []) {
      for (const a of (h.value || "").match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []) out.add(a.toLowerCase());
    }
  }
  return Array.from(out);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function sendMail(
  token: string,
  m: { to: string; subject: string; text: string; html: string; threadId?: string | null; inReplyTo?: string | null },
): Promise<{ id: string; threadId: string; messageId: string | null }> {
  const boundary = "a10" + Math.random().toString(36).slice(2);
  const head = [`To: ${m.to}`, `Subject: ${encodeMimeHeader(m.subject)}`, "MIME-Version: 1.0"];
  if (m.inReplyTo) head.push(`In-Reply-To: ${m.inReplyTo}`, `References: ${m.inReplyTo}`);
  head.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const mime = [
    ...head, "",
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.text), "",
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.html), "",
    `--${boundary}--`,
  ].join("\r\n");
  const body: any = { raw: b64url(mime) };
  if (m.threadId) body.threadId = m.threadId;
  const r = await fetch(`${G}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`send ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  let messageId: string | null = null;
  try { messageId = (await getMeta(token, j.id)).h["message-id"] || null; } catch { /* only used for later bumps */ }
  return { id: j.id, threadId: j.threadId, messageId };
}
