/**
 * setup-growth-cron.mjs — (re)install the growth engine's heartbeat.
 *
 *   node scripts/setup-growth-cron.mjs
 *
 * Vercel Hobby crons fire once a day, which cannot space 25 emails across a
 * morning. Supabase's own pg_cron + pg_net can: every 10 minutes it POSTs to
 * /api/growth/tick with the GROWTH_SECRET bearer. The secret lives in Supabase
 * Vault (never in the job text) and in .env.local / Vercel env.
 *
 * Idempotent: re-running replaces the vault secret and the job.
 * Stop it:  select cron.unschedule('growth-tick');
 */
import fs from 'fs';
import crypto from 'crypto';
import pg from 'pg';

const ENV_PATH = '.env.local';
let envText = fs.readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
}));

let secret = env.GROWTH_SECRET;
if (!secret) {
  secret = crypto.randomBytes(24).toString('hex');
  envText = envText.replace(/\s*$/, '\n') + `GROWTH_SECRET=${secret}\n`;
  fs.writeFileSync(ENV_PATH, envText);
  console.log('Generated GROWTH_SECRET and wrote it to .env.local — add the same value to Vercel (production).');
}

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query('create extension if not exists pg_cron');
await c.query('create extension if not exists pg_net');
await c.query(`delete from vault.secrets where name = 'growth_secret'`);
await c.query(`select vault.create_secret($1, 'growth_secret', 'Bearer for /api/growth/tick')`, [secret]);
await c.query(`select cron.unschedule(jobid) from cron.job where jobname = 'growth-tick'`);
// 14:00–23:50 UTC = 7am–4:50pm PDT (6am–3:50pm PST). The tick itself decides
// whether it is a sending minute; outside the window it only reads the inbox
// and finds prospects.
await c.query(`select cron.schedule('growth-tick', '*/10 14-23 * * *', $$
  select net.http_post(
    url := 'https://wholesale.getactive10.com/api/growth/tick',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'growth_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$)`);
const { rows } = await c.query(`select jobid, jobname, schedule, active from cron.job where jobname = 'growth-tick'`);
console.table(rows);
await c.end();
