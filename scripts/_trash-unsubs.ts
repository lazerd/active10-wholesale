// @ts-nocheck  (one-off script; pg has no types installed, and this must not break the Vercel build)
// Trash unsubscribe emails in activeformulations@ ONLY when the sender is already in growth_suppression.
import { getGmailAccess } from "../src/lib/gmail";
import pg from "pg"; import fs from "fs";
const env = fs.readFileSync(".env.local","utf8"); const E = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`,"m"))||[])[1]?.replace(/^"|"$/g,"").trim()!;
(async () => {
  const live = process.argv[2] === "live";
  const u = new URL(E("DATABASE_URL")); const c = new pg.Client({ host: u.hostname, port: +u.port || 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } }); await c.connect();
  const rows = (await c.query(`select e.gmail_id, lower(e.email) email from growth_events e join growth_suppression s on lower(s.email)=lower(e.email) where e.kind='unsubscribe' and e.gmail_id is not null`)).rows;
  await c.end();
  const t = await getGmailAccess(); const H = { Authorization: `Bearer ${t}` };
  let ok = 0, gone = 0, fail = 0;
  for (const r of rows) {
    const m = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.gmail_id}?format=minimal`, { headers: H }).then(x => x.json());
    if (!m.id || (m.labelIds || []).includes("TRASH")) { gone++; continue; }
    if (!live) { ok++; continue; }
    const x = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.gmail_id}/trash`, { method: "POST", headers: H });
    if (x.ok) ok++; else { fail++; console.log(r.email, x.status, (await x.text()).slice(0, 120)); }
  }
  console.log(`${live ? "trashed" : "would trash"} ${ok} | already gone ${gone} | failed ${fail} | of ${rows.length}`);
})();
