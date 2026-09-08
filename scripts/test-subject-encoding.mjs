/**
 * test-subject-encoding.mjs — sends ONE message, to Darrin only, to prove the
 * RFC 2047 subject fix renders correctly in a real inbox.
 *
 *   node scripts/test-subject-encoding.mjs
 *
 * Hardcoded to darrinjco@gmail.com on purpose: this must never be pointable at
 * a prospect. It reuses the exact MIME assembly from send-chiro-batch.mjs so
 * what it proves is what the batch will do.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { encodeMimeHeader } from './mimeHeader.mjs';

const TO = 'darrinjco@gmail.com'; // never a prospect
const SUBJECT = 'Active 10 — samples for Valley Spine & Health?';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const env = Object.fromEntries(
  fs.readFileSync(path.join(HERE, '..', '.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await db.from('gmail_tokens').select('*').eq('id', 'default').single();
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || data.client_id || '',
    client_secret: env.GOOGLE_CLIENT_SECRET || data.client_secret || '',
    refresh_token: data.refresh_token,
    grant_type: 'refresh_token',
  }),
});
const token = (await tokenRes.json()).access_token;

const b64url = (s) =>
  Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const boundary = 'b' + Math.random().toString(36).slice(2);
const mime = [
  `To: ${TO}`,
  `Subject: ${encodeMimeHeader(SUBJECT)}`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/alternative; boundary="${boundary}"`,
  '',
  `--${boundary}`,
  'Content-Type: text/plain; charset="UTF-8"',
  '',
  'Encoding test. The subject of this message should read:\n\n  ' + SUBJECT + '\n\nIf the dash renders correctly here, the batch is fixed.',
  '',
  `--${boundary}`,
  'Content-Type: text/html; charset="UTF-8"',
  '',
  '<div>Encoding test. The subject should read:<br><br><b>' + SUBJECT + '</b><br><br>If the dash renders correctly, the batch is fixed.</div>',
  '',
  `--${boundary}--`,
].join('\r\n');

console.log('Subject header on the wire:');
console.log('  ' + encodeMimeHeader(SUBJECT).split('\r\n').join('\n  '));

const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: b64url(mime) }),
});
if (!res.ok) {
  console.error('FAILED:', res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}
const id = (await res.json()).id;
console.log(`\nSent to ${TO} (message ${id}).`);

// Read it back the way any client would, to confirm Gmail decoded the header.
const check = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const j = await check.json();
const decoded = j.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value;
console.log('Gmail decodes it back as:');
console.log('  ' + decoded);
console.log('\nMATCHES ORIGINAL: ' + (decoded === SUBJECT ? 'YES' : 'NO'));
