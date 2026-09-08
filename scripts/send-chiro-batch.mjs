/**
 * send-chiro-batch.mjs — send the chiropractor first-touch batch, staggered.
 *
 *   node scripts/send-chiro-batch.mjs                # dry run, shows the plan
 *   node scripts/send-chiro-batch.mjs --live         # actually sends
 *   node scripts/send-chiro-batch.mjs --live --gap 180
 *
 * WHY A SCRIPT AND NOT GMAIL'S SCHEDULE SEND: Gmail's API has no scheduled-send
 * endpoint, and Gmail's own scheduler fires every message at the same instant.
 * Thirty messages leaving one consumer Gmail in the same minute is the exact
 * signature of a blast. This spaces them out across the morning instead, which
 * is the whole point.
 *
 * DOUBLE-SEND IS IMPOSSIBLE BY DESIGN. Before each send it searches the Sent
 * folder for that recipient. If Darrin already sent the Gmail draft by hand, or
 * the task somehow runs twice, that recipient is skipped. The local send log is
 * a second belt on the same trousers.
 *
 * Uses the portal's own Gmail connection (gmail_tokens in Supabase) — the same
 * one the outreach admin sends through. Needs only gmail.send + gmail.readonly,
 * both of which that token already has, so no reconnect is required.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { encodeMimeHeader } from './mimeHeader.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const LOG_PATH = path.join(HERE, 'chiro-batch-sent.json');

const LIVE = process.argv.includes('--live');
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
/** Seconds between sends. 150s over 30 messages ≈ 75 minutes. */
const GAP = Number(arg('gap', '150'));

// ------------------------------------------------------------- the batch --
// Greeting per recipient: a real surname where the address and the practice
// name agree on one, otherwise the practice. Never "Hi there", and never a
// guessed surname — getting a doctor's name wrong is worse than not using it.
const RECIPIENTS = [
  ['drferch@ferchchiro.com', 'Dr. Ferch,'],
  ['drliguori@chirosportshealth.com', 'Dr. Liguori,'],
  ['erikrosenbergchiro@yahoo.com', 'Dr. Rosenberg,'],
  ['hulbertsportschiropractic@gmail.com', 'Dr. Hulbert,'],
  ['docrardin@gmail.com', 'Dr. Rardin,'],
  ['hansenchiropractic@hotmail.com', 'Dr. Hansen,'],
  ['diamondmobilechiro@gmail.com', 'Dr. Diamond,'],
  ['scottcoulter@cableone.net', 'Dr. Coulter,'],
  ['drdumler@gmail.com', 'Dr. Dumler,'],
  ['drmoyher@comcast.net', 'Dr. Moyher,'],
  ['reception@fixmyback.com', 'Hi Healing Touch team,'],
  ['info@thelasvegaschiro.com', 'Hi Las Vegas Chiropractor team,'],
  ['info@chiropracticlv.com', 'Hi N.W. Chiropractic team,'],
  ['info@wrightclinic.com', 'Hi Wright Chiropractic team,'],
  ['info@activenevadachiropractic.com', 'Hi Active Nevada team,'],
  ['info@nguyenchiro.com', 'Hi Nguyen Chiropractic team,'],
  ['contact@mychiropractoraz.com', 'Hi MyChiropractor Health team,'],
  ['info@sylvanchiropractic.com', 'Hi Sylvan Chiropractic team,'],
  ['contact@portlandwellnesscare.com', 'Hi Portland Wellness Care team,'],
  ['frontdesk@corbetthill.com', 'Hi Corbett Hill team,'],
  ['info@premiercarechiro.com', 'Hi Keesee Sports Chiropractic team,'],
  ['officemanager@expressionschirodallas.com', 'Hi Expressions Chiropractic team,'],
  ['admin@backpro.net', 'Hi Inwood Chiropractic team,'],
  ['chirodoc10@hotmail.com', 'Hi San Diego Chiropractic team,'],
  ['doctorlance@hotmail.com', 'Hi Cool Chiropractic team,'],
  ['azlifechiro@msn.com', 'Hi Arizona Life Chiropractic team,'],
  ['wellnessofboise@yahoo.com', 'Hi Wellness Center of Boise team,'],
  ['drbrae@gmail.com', 'Hi Boise Apex Chiropractic team,'],
  ['hankschiro@gmail.com', "Hi Hank's Chiropractic team,"],
  ['denverphysicalmed@gmail.com', 'Hi Denver Physical Medicine team,'],
];

/** Subject per recipient — the practice's own name, the shape that earned a reply. */
const SUBJECTS = {
  'drferch@ferchchiro.com': 'Active 10 — samples for Ferch Family Chiropractic?',
  'drliguori@chirosportshealth.com': 'Active 10 — samples for Chiropractic & Sports Health?',
  'erikrosenbergchiro@yahoo.com': 'Active 10 — samples for San Diego Sports and Spine?',
  'hulbertsportschiropractic@gmail.com': 'Active 10 — samples for Hulbert Sports Chiropractic?',
  'docrardin@gmail.com': 'Active 10 — samples for Foundation of Health?',
  'hansenchiropractic@hotmail.com': 'Active 10 — samples for Hansen Chiropractic?',
  'diamondmobilechiro@gmail.com': 'Active 10 — samples for Diamond Mobile Chiropractic?',
  'scottcoulter@cableone.net': 'Active 10 — samples for Coulter Family Chiropractic?',
  'drdumler@gmail.com': 'Active 10 — samples for Valley Spine & Health?',
  'drmoyher@comcast.net': 'Active 10 — samples for Dallas Chiropractic Life?',
  'reception@fixmyback.com': 'Active 10 — samples for The Healing Touch?',
  'info@thelasvegaschiro.com': 'Active 10 — samples for The Las Vegas Chiropractor?',
  'info@chiropracticlv.com': 'Active 10 — samples for N.W. Chiropractic?',
  'info@wrightclinic.com': 'Active 10 — samples for Wright Chiropractic?',
  'info@activenevadachiropractic.com': 'Active 10 — samples for Active Nevada Chiropractic?',
  'info@nguyenchiro.com': 'Active 10 — samples for Nguyen Chiropractic?',
  'contact@mychiropractoraz.com': 'Active 10 — samples for MyChiropractor Health?',
  'info@sylvanchiropractic.com': 'Active 10 — samples for Sylvan Chiropractic?',
  'contact@portlandwellnesscare.com': 'Active 10 — samples for Portland Wellness Care?',
  'frontdesk@corbetthill.com': 'Active 10 — samples for Corbett Hill?',
  'info@premiercarechiro.com': 'Active 10 — samples for Keesee Sports Chiropractic?',
  'officemanager@expressionschirodallas.com': 'Active 10 — samples for Expressions Chiropractic?',
  'admin@backpro.net': 'Active 10 — samples for Inwood Chiropractic?',
  'chirodoc10@hotmail.com': 'Active 10 — samples for San Diego Chiropractic?',
  'doctorlance@hotmail.com': 'Active 10 — samples for Cool Chiropractic?',
  'azlifechiro@msn.com': 'Active 10 — samples for Arizona Life Chiropractic?',
  'wellnessofboise@yahoo.com': 'Active 10 — samples for The Wellness Center of Boise?',
  'drbrae@gmail.com': 'Active 10 — samples for Boise Apex Chiropractic?',
  'hankschiro@gmail.com': 'Active 10 — samples for your practice?',
  'denverphysicalmed@gmail.com': 'Active 10 — samples for Denver Physical Medicine?',
};

const PARAS = [
  "I'll keep this short because I know your day is booked back to back.",
  "My name is Darrin and I make Active 10, a topical pain relief cream. Chiropractors were our first real customers. Before we ever sold a single jar online, it was DCs using it on patients during adjustments and selling it at the front desk. Years later, that's still the heart of the business — hundreds of practices around the country carry it now.",
  "The short version of why it sticks: patients use it after their adjustment and between visits, they feel the difference, and they come back to your front desk asking for more. It sells itself once it's on the shelf, and the margins actually make it worth shelf space.",
  "But I'd rather you judge that yourself than take my word for it. Reply with your shipping address and I'll personally get samples in the mail to you this week. No catch, no sales call, no ten-email follow-up sequence. Try it on yourself, try it on a few patients, and see what they say.",
];
const OFFER_TEXT =
  "If it earns a spot in the practice, the first order is simple: our starter kit is 3 tubes, 3 roll-ons and 10 single-use sample packets for $99 shipped. That's about $120 at normal wholesale, and $240 of retail sitting on your front desk.";
const OFFER_HTML =
  OFFER_TEXT +
  ' Setting up the account takes two minutes at <a href="https://wholesale.getactive10.com">wholesale.getactive10.com</a>.';
const SIGNOFF = ["Either way, thanks for reading this far. I mean that.", 'Darrin Cohen\nFounder, Active 10\n800-636-4130'];

const textBody = (greeting) =>
  [greeting, ...PARAS, OFFER_TEXT, SIGNOFF[0], SIGNOFF[1]].join('\n\n');

// The URL lives ONLY in the HTML part. Gmail rewrites a bare URL in plain text
// into its own google.com/url redirect, and with no anchor to hold the display
// text the redirect becomes the visible text.
const htmlBody = (greeting) =>
  '<div>' +
  [greeting, ...PARAS, OFFER_HTML, SIGNOFF[0], SIGNOFF[1].replace(/\n/g, '<br>')].join('<br><br>') +
  '</div>';

// ------------------------------------------------------------------ gmail --
const env = Object.fromEntries(
  fs.readFileSync(path.join(HERE, '..', '.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function gmailToken() {
  const { data } = await db.from('gmail_tokens').select('*').eq('id', 'default').single();
  if (!data?.refresh_token) throw new Error('Gmail is not connected in the portal (gmail_tokens is empty).');
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
  const j = await res.json();
  return j.access_token;
}

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Has anything already gone to this address? Gmail is the source of truth. */
async function alreadySent(token, email) {
  const q = encodeURIComponent(`in:sent to:${email} newer_than:30d`);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false; // never let a failed check block the send
  const j = await res.json();
  return (j.resultSizeEstimate || 0) > 0;
}

async function sendOne(token, to, subject, text, html) {
  const boundary = 'b' + Math.random().toString(36).slice(2);
  const mime = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(mime) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadLog = () => (fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : {});
const saveLog = (l) => fs.writeFileSync(LOG_PATH, JSON.stringify(l, null, 2));

// -------------------------------------------------------------------- main --
async function main() {
  console.log(`${RECIPIENTS.length} recipients · ${GAP}s apart · ~${Math.round((RECIPIENTS.length * GAP) / 60)} min total`);
  console.log(LIVE ? 'MODE: LIVE — will send\n' : 'MODE: dry run — nothing will be sent\n');

  const log = loadLog();
  const token = LIVE || process.argv.includes('--check') ? await gmailToken() : null;

  let sent = 0, skipped = 0, failed = 0;
  for (const [email, greeting] of RECIPIENTS) {
    const subject = SUBJECTS[email];
    if (log[email]) { console.log(`  skip  ${email.padEnd(40)} sent ${log[email].at.slice(0, 16)}`); skipped++; continue; }

    if (token && (await alreadySent(token, email))) {
      console.log(`  skip  ${email.padEnd(40)} already in Sent`);
      // Only record it on a real run — a dry run must not mutate anything.
      if (LIVE) { log[email] = { at: new Date().toISOString(), via: 'found in Sent, not re-sent' }; saveLog(log); }
      skipped++;
      continue;
    }

    if (!LIVE) { console.log(`  SEND  ${email.padEnd(40)} ${subject}`); sent++; continue; }

    try {
      const id = await sendOne(token, email, subject, textBody(greeting), htmlBody(greeting));
      log[email] = { at: new Date().toISOString(), messageId: id };
      saveLog(log);
      sent++;
      console.log(`  sent  ${email.padEnd(40)} ${new Date().toLocaleTimeString()}`);

      // Mark it in the CRM so replies get watched and nothing re-drafts them.
      const { data: p } = await db.from('outreach_prospects').select('id, touch_count').eq('email', email).maybeSingle();
      if (p) {
        const tc = (p.touch_count || 0) + 1;
        await db.from('outreach_prospects')
          .update({ status: tc > 1 ? 'followed_up' : 'emailed', touch_count: tc, last_contacted_at: new Date().toISOString() })
          .eq('id', p.id);
        await db.from('outreach_touches')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('prospect_id', p.id).eq('status', 'draft');
      }
    } catch (e) {
      failed++;
      console.error(`  FAIL  ${email.padEnd(40)} ${e.message}`);
    }

    if (GAP > 0) await sleep(GAP * 1000);
  }

  console.log(`\n${sent} sent · ${skipped} skipped · ${failed} failed`);
  if (!LIVE) console.log('Dry run. Re-run with --live to send.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
