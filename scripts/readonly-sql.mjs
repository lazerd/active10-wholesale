// Runs a SELECT against the Active 10 database inside a READ ONLY transaction, so a
// skill or a typo can never write. Same connection setup as dbrun.mjs.
//   node scripts/readonly-sql.mjs "select name, total_spent from customers order by total_spent desc limit 10"
//   node scripts/readonly-sql.mjs --json "select ..."   # rows as JSON instead of a table
import fs from "fs";
import pg from "pg";

const url = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
if (!url) { console.error("DATABASE_URL missing from .env.local"); process.exit(1); }
const u = new URL(url);
const client = new pg.Client({
  host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password), database: u.pathname.slice(1) || "postgres", ssl: { rejectUnauthorized: false },
});
const json = process.argv[2] === "--json";
const sql = process.argv[json ? 3 : 2];
if (!sql) { console.error('usage: node scripts/readonly-sql.mjs [--json] "select ..."'); process.exit(1); }
await client.connect();
try {
  await client.query("begin transaction read only");
  const r = await client.query(sql);
  for (const x of [].concat(r)) {
    if (json) console.log(JSON.stringify(x.rows ?? [], null, 1));
    else if (x.rows?.length) console.table(x.rows);
    else console.log(x.command, x.rowCount ?? "");
  }
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
