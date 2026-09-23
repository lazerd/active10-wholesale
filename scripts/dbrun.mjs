// Runs SQL against the Active 10 database (DATABASE_URL in .env.local).
//   node scripts/dbrun.mjs supabase/migrations/0018_x.sql
//   node scripts/dbrun.mjs "select count(*) from growth_variants"
// Pass pooler fields separately: pg's connectionString parser rejects Supabase pooler usernames.
import fs from "fs";
import pg from "pg";

const url = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
if (!url) { console.error("DATABASE_URL missing from .env.local"); process.exit(1); }
const u = new URL(url);
const client = new pg.Client({
  host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password), database: u.pathname.slice(1) || "postgres", ssl: { rejectUnauthorized: false },
});
const arg = process.argv[2];
const sql = arg?.endsWith(".sql") ? fs.readFileSync(arg, "utf8") : arg;
if (!sql) { console.error("usage: node scripts/dbrun.mjs <file.sql | \"sql\">"); process.exit(1); }
await client.connect();
const r = await client.query(sql);
for (const x of [].concat(r)) if (x.rows?.length) console.table(x.rows); else console.log(x.command, x.rowCount ?? "");
await client.end();
