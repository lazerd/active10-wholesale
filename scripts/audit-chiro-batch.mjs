/**
 * audit-chiro-batch.mjs — READ ONLY. Reconciles what the chiropractor batch
 * actually sent against the local log and the CRM.
 *
 *   node scripts/audit-chiro-batch.mjs
 *
 * Written after the 2026-09-08 run was killed mid-flight: the local log is
 * written AFTER each send, so a message sent in the instant before the kill
 * would be in Gmail but not in the log. Gmail's Sent folder is the only
 * trustworthy record of what reached a chiropractor, so this asks Gmail.
 *
 * Sends nothing and writes nothing.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const env = Object.fromEntries(
  fs.readFileSync(path.join(HERE, '..', '.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function gmailToken() {
  const { data } = await db.from('gmail_tokens').select('*').eq('id', 'default').single();
  if (!data?.refresh_token) throw new Error('Gmail is not connected in the portal.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || data.client_id || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || data.client_secret || '',
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Gmail token refresh failed: ' + (await res.text()).slice(0, 200));
  return (await res.json()).access_token;
}

const { RECIPIENTS } = await import('./chiro-recipients.mjs').catch(() => ({ RECIPIENTS: null }));

// Fall back to reading the address list straight out of the sender script so
// this audit never drifts from the real batch.
const src = fs.readFileSync(path.join(HERE, 'send-chiro-batch.mjs'), 'utf8');
const addresses =
  RECIPIENTS?.map((r) => r[0]) ??
  [...src.matchAll(/\['([^']+@[^']+)',/g)].map((m) => m[1]);

const token = await gmailToken();

/** Ask Gmail whether anything went to this address today. */
async function sentToday(email) {
  const q = encodeURIComponent(`in:sent to:${email} newer_than:2d`);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return { error: `${res.status}` };
  const j = await res.json();
  const ids = (j.messages || []).map((m) => m.id);
  if (!ids.length) return { sent: false };

  // Pull the raw Subject header so we can see how it actually went out.
  const detail = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ids[0]}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const d = detail.ok ? await detail.json() : null;
  const hdr = (n) => d?.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || '';
  return { sent: true, count: ids.length, subject: hdr('subject'), date: hdr('date') };
}

const LOG_PATH = path.join(HERE, 'chiro-batch-sent.json');
const log = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : {};

console.log(`Auditing ${addresses.length} addresses against Gmail's Sent folder...\n`);

const sent = [];
const notSent = [];
for (const email of addresses) {
  const r = await sentToday(email);
  const inLog = !!log[email];
  if (r.sent) {
    sent.push({ email, inLog, subject: r.subject });
    console.log(`SENT      ${email}${inLog ? '' : '   <-- NOT IN LOCAL LOG'}`);
    if (r.subject) console.log(`          subject on the wire: ${r.subject}`);
  } else {
    notSent.push(email);
  }
}

console.log(`\n--- not sent (${notSent.length}) ---`);
notSent.forEach((e) => console.log('  ' + e));

console.log(`\nSENT: ${sent.length}   NOT SENT: ${notSent.length}   LOCAL LOG: ${Object.keys(log).length}`);
const missing = sent.filter((s) => !s.inLog);
if (missing.length) {
  console.log(`\nWARNING: ${missing.length} send(s) reached Gmail but are missing from the local log:`);
  missing.forEach((m) => console.log('  ' + m.email));
}
