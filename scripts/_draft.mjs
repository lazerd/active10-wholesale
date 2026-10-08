// Reply-in-thread draft in activeformulations@gmail.com. node _draft.mjs <gmail search for the message to answer> <body file> [to override]
import fs from "fs";
const env = fs.readFileSync(".env.local","utf8"); const E = k => (env.match(new RegExp(`^${k}=(.*)$`,"m"))||[])[1]?.replace(/^"|"$/g,"").trim();
const SB = E("NEXT_PUBLIC_SUPABASE_URL"), SK = E("SUPABASE_SERVICE_ROLE_KEY");
const row = (await fetch(`${SB}/rest/v1/gmail_tokens?id=eq.default&select=*`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } }).then(r => r.json()))[0];
const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: E("GOOGLE_CLIENT_ID"), client_secret: E("GOOGLE_CLIENT_SECRET"), refresh_token: row.refresh_token, grant_type: "refresh_token" }) }).then(r => r.json());
const H = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
const g = p => fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + p, { headers: H }).then(r => r.json());
if ((await g("profile")).emailAddress !== "activeformulations@gmail.com") throw new Error("wrong mailbox");
const m = (await g("messages?maxResults=1&q=" + encodeURIComponent(process.argv[2]))).messages[0];
const d = await g(`messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=To`);
const h = Object.fromEntries(d.payload.headers.map(x => [x.name.toLowerCase(), x.value]));
const to = process.argv[4] || h["reply-to"] || h.from;
const subj = /^re:/i.test(h.subject) ? h.subject : "Re: " + h.subject;
const body = fs.readFileSync(process.argv[3], "utf8");
const raw = [`To: ${to}`, `Subject: ${subj}`, `In-Reply-To: ${h["message-id"]}`, `References: ${(h.references ? h.references + " " : "") + h["message-id"]}`, "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", { method: "POST", headers: H, body: JSON.stringify({ message: { raw: Buffer.from(raw).toString("base64url"), threadId: d.threadId } }) }).then(r => r.json());
console.log(r.id ? `draft ${r.id} → ${to} | ${subj}` : JSON.stringify(r));
