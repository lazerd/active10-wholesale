// 11/17/26 Darrin: every new chiro gets the "3 free 4oz tubes + CBD sample packets" offer.
// Adds variant F (B's proven wording + the new offer) and retires A–E so F is the only chiro letter.
// Reversible: set the old ones back to 'active'.
import pg from "pg";
import { readFileSync } from "node:fs";
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !process.env[l.slice(0, i)]) process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^"|"$/g, "");
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const subject = "3 free tubes for {business}?";
const body = `{greeting}

I make Active 10, a topical pain relief cream. Chiropractors were our very first customers and a lot of practices sell it right at the front desk.

I'd like to mail you 3 free 4oz tubes of our original formula, plus a few sample packets of our CBD version. Try it yourself, use it on patients after an adjustment, and see what they think.

Just reply with the best address and I'll get them out to you.

Thanks,
Darrin Cohen
Founder, Active 10
800-636-4130`;

const have = await c.query(`select id from growth_variants where lane='chiro' and name like 'F ·%'`);
if (!have.rows.length)
  await c.query(
    `insert into growth_variants (lane, name, angle, subject, body, status, source, notes, decided_at)
     values ('chiro', 'F · 3 free tubes', 'free 3x4oz tubes + CBD packets', $1, $2, 'active', 'darrin', 'Darrin 11/17: offer to every new chiro', now())`,
    [subject, body]
  );
const r = await c.query(
  `update growth_variants set status='retired', decided_at=now(), notes=coalesce(notes,'') || ' | retired 11/17 for F (free tubes offer)'
   where lane='chiro' and name not like 'F ·%' and status in ('active','proposed') returning name`
);
console.log("retired:", r.rows.map((x) => x.name));
console.log((await c.query(`select name,status from growth_variants where lane='chiro' order by name`)).rows);
await c.end();
