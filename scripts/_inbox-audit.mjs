// Dump activeformulations@ inbox since a date with the growth_events kind recorded for each message.
import fs from "fs"; import pg from "pg";
const env = fs.readFileSync(".env.local","utf8"); const E = k => (env.match(new RegExp(`^${k}=(.*)$`,"m"))||[])[1]?.replace(/^"|"$/g,"").trim();
const SB = E("NEXT_PUBLIC_SUPABASE_URL"), SK = E("SUPABASE_SERVICE_ROLE_KEY");
const row = (await fetch(`${SB}/rest/v1/gmail_tokens?id=eq.default&select=*`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } }).then(r => r.json()))[0];
const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: E("GOOGLE_CLIENT_ID"), client_secret: E("GOOGLE_CLIENT_SECRET"), refresh_token: row.refresh_token, grant_type: "refresh_token" }) }).then(r => r.json());
const H = { Authorization: `Bearer ${tok.access_token}` };
const g = p => fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + p, { headers: H }).then(r => r.json());
const q = process.argv[2] || "after:2026/09/28 -in:sent -in:chats -in:drafts";
let ids = [], pt = "";
do { const r = await g(`messages?maxResults=500&q=${encodeURIComponent(q)}${pt ? "&pageToken=" + pt : ""}`); ids.push(...(r.messages || []).map(m => m.id)); pt = r.nextPageToken; } while (pt);
const u = new URL(E("DATABASE_URL")); const c = new pg.Client({ host: u.hostname, port: +u.port || 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } }); await c.connect();
const ev = (await c.query("select gmail_id, string_agg(kind, '+') k from growth_events where gmail_id = any($1) group by 1", [ids])).rows;
const evm = Object.fromEntries(ev.map(r => [r.gmail_id, r.k]));
const out = [];
for (const id of ids) {
  const d = await g(`messages/${id}?format=full`);
  const h = Object.fromEntries((d.payload?.headers || []).map(x => [x.name.toLowerCase(), x.value]));
  const parts = []; const walk = p => { if (!p) return; if (p.mimeType === "text/plain" && p.body?.data) parts.push(Buffer.from(p.body.data, "base64url").toString()); (p.parts || []).forEach(walk); }; walk(d.payload);
  out.push({ id, date: h.date, from: h.from, to: h.to, subject: h.subject, ev: evm[id] || "", snippet: d.snippet, body: (parts.join("\n") || "").slice(0, 3000), labels: d.labelIds });
}
await c.end();
fs.writeFileSync(process.argv[3] || "inbox-audit.json", JSON.stringify(out, null, 1));
console.log(ids.length, "messages");
