/**
 * find-chiros.mjs — build the chiropractor prospect list.
 *
 * The outreach engine has been ready since June; what it has never had is a
 * list. 26 chiropractors were in the CRM and 21 were already emailed, so a
 * 30/day quota drafts five emails and then stops. This fills it.
 *
 *   node scripts/find-chiros.mjs --cities "Walnut Creek CA,Danville CA"
 *   node scripts/find-chiros.mjs --cities-file cities.txt --limit 200 --live
 *
 * Preview by default. --live inserts. Re-running is safe: every candidate is
 * checked against the existing prospects by email AND by website host, so a
 * practice already in the CRM is never added twice and never re-emailed.
 *
 * METHOD, and why it is this one:
 *   State chiropractic boards publish licensee rosters, but they carry mailing
 *   addresses and licence numbers — no email. Cold email needs an address, so
 *   the only route is the practice's own website, which publishes one on the
 *   contact page. That is exactly where the existing 26 rows came from
 *   (source = "web scrape", emails like info@seattlefamilychiro.com).
 *
 * Search uses the Brave Search API — the admin UI already reports a
 * BRAVE_API_KEY capability (`searchOn`), the free tier is 2,000 queries/month,
 * and one query covers a city. Put BRAVE_API_KEY in .env.local.
 * Get one at https://brave.com/search/api/ (Free plan, card required, $0).
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ------------------------------------------------------------------- config --
const LIVE = process.argv.includes('--live');
const arg = (n, d = null) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const LIMIT = Number(arg('limit', '150'));
const PER_CITY = Number(arg('per-city', '20'));

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  }),
);

let cities = [];
const citiesFile = arg('cities-file');
if (citiesFile) cities = fs.readFileSync(citiesFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
else if (arg('cities')) cities = arg('cities').split(',').map((s) => s.trim()).filter(Boolean);

if (!cities.length) {
  console.error('Give me somewhere to look:');
  console.error('  node scripts/find-chiros.mjs --cities "Walnut Creek CA,Danville CA"');
  console.error('  node scripts/find-chiros.mjs --cities-file cities.txt --live');
  process.exit(1);
}
if (!env.BRAVE_API_KEY) {
  console.error('BRAVE_API_KEY is not in .env.local.');
  console.error('Free key (2,000 queries/month) at https://brave.com/search/api/ — one query per city.');
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ------------------------------------------------------------------ helpers --
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Directories, aggregators and marketplaces — not a practice we can write to. */
const SKIP_HOSTS = [
  'yelp.', 'yellowpages.', 'facebook.', 'instagram.', 'linkedin.', 'mapquest.',
  'healthgrades.', 'zocdoc.', 'wellness.com', 'chiropractic.org', 'ratemds.',
  'indeed.', 'ziprecruiter.', 'bbb.org', 'tripadvisor.', 'youtube.', 'wikipedia.',
  'amazon.', 'groupon.', 'nextdoor.', 'apple.com', 'google.',
];

/** Shared inboxes we do NOT want — no-reply and the like never reach a human. */
const BAD_LOCALPARTS = ['no-reply', 'noreply', 'donotreply', 'postmaster', 'abuse', 'privacy', 'webmaster'];

/**
 * Consumer mail hosts. A customer at gmail.com must never blacklist gmail.com
 * for everyone else, so the domain-level customer check skips these.
 */
const FREE_MAIL = [
  'gmail.com', 'yahoo.com', 'aol.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'me.com', 'mac.com', 'msn.com', 'comcast.net', 'att.net', 'earthlink.net',
  'sbcglobal.net', 'verizon.net', 'live.com', 'protonmail.com', 'proton.me',
];

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

async function braveSearch(query) {
  const res = await fetch(
    'https://api.search.brave.com/res/v1/web/search?count=20&q=' + encodeURIComponent(query),
    { headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY } },
  );
  if (!res.ok) throw new Error('Brave search ' + res.status + ' ' + (await res.text()).slice(0, 120));
  const json = await res.json();
  return (json.web?.results || []).map((r) => ({ title: r.title, url: r.url, description: r.description }));
}

/**
 * Pull a contact address off the practice site. Tries the homepage, then the
 * usual contact paths — many practices only publish the address one click in.
 */
async function findEmail(siteUrl) {
  const base = siteUrl.replace(/\/+$/, '');
  const paths = ['', '/contact', '/contact-us', '/contactus', '/about', '/about-us'];
  for (const p of paths) {
    try {
      const res = await fetch(base + p, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Active10Outreach/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const found = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      for (const raw of found) {
        const email = raw.toLowerCase();
        // Image filenames and asset hashes turn up as false positives.
        if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
        if (/(sentry|wixpress|example|domain|yourname|placeholder)\./.test(email)) continue;
        if (BAD_LOCALPARTS.some((b) => email.startsWith(b + '@'))) continue;
        return email;
      }
    } catch {
      /* try the next path */
    }
  }
  return null;
}

// --------------------------------------------------------------------- main --
async function main() {
  console.log(`${cities.length} ${cities.length === 1 ? 'city' : 'cities'} · up to ${PER_CITY} per city · cap ${LIMIT}`);
  console.log(LIVE ? 'MODE: LIVE — will insert\n' : 'MODE: preview — nothing will be written\n');

  // Everything already in the CRM, so we never touch a practice twice.
  const { data: existing } = await db.from('outreach_prospects').select('email, website');
  const haveEmail = new Set((existing || []).map((r) => (r.email || '').toLowerCase()).filter(Boolean));
  const haveHost = new Set((existing || []).map((r) => hostOf(r.website || '')).filter(Boolean));

  // ...and everyone who ALREADY BUYS from us. Cold-pitching free samples to a
  // paying practice is the single worst thing this script could do, and the
  // prospect table alone would not catch it — customers live in `customers`.
  // Match on the address and on the practice's domain, since the person who
  // opened the account (dr.smith@) is often not the address on the website
  // (info@). Free mail hosts are excluded from the domain rule or gmail.com
  // would blacklist the internet.
  const { data: customers } = await db.from('customers').select('email');
  for (const c of customers || []) {
    const e = (c.email || '').toLowerCase();
    if (!e) continue;
    haveEmail.add(e);
    const d = e.split('@')[1];
    if (d && !FREE_MAIL.includes(d)) haveHost.add(d);
  }

  console.log(`already known: ${haveEmail.size} addresses across ${haveHost.size} domains (prospects + customers)\n`);

  const found = [];
  const seenHost = new Set();

  for (const city of cities) {
    if (found.length >= LIMIT) break;
    let results = [];
    try {
      results = await braveSearch(`chiropractor ${city}`);
    } catch (e) {
      console.log(`  ! ${city}: ${e.message}`);
      continue;
    }

    let added = 0;
    for (const r of results) {
      if (found.length >= LIMIT || added >= PER_CITY) break;
      const host = hostOf(r.url);
      if (!host || seenHost.has(host) || haveHost.has(host)) continue;
      if (SKIP_HOSTS.some((s) => host.includes(s))) continue;
      seenHost.add(host);

      const email = await findEmail('https://' + host);
      if (!email) { console.log(`  –  ${host.padEnd(38)} no address published`); continue; }
      if (haveEmail.has(email)) { console.log(`  –  ${host.padEnd(38)} already have ${email}`); continue; }
      haveEmail.add(email);

      const business = (r.title || host).replace(/\s+/g, ' ').trim().slice(0, 160);
      found.push({ business, email, website: 'https://' + host, city, type: 'chiropractor', source: 'web scrape', status: 'prospected', channel: 'email' });
      added += 1;
      console.log(`  +  ${host.padEnd(38)} ${email}`);
      await sleep(400); // be a considerate visitor
    }
    console.log(`${city}: ${added} new\n`);
    await sleep(1100); // Brave free tier is rate-limited per second
  }

  console.log(`\n${found.length} new prospects found.`);
  if (!found.length) return;

  if (!LIVE) {
    console.log('Preview only. Re-run with --live to add them.');
    return;
  }

  // Insert in chunks so one oversized request cannot lose the whole run.
  let inserted = 0;
  for (let i = 0; i < found.length; i += 100) {
    const chunk = found.slice(i, i + 100);
    const { error } = await db.from('outreach_prospects').insert(chunk);
    if (error) { console.error('insert failed:', error.message); break; }
    inserted += chunk.length;
  }
  console.log(`Added ${inserted} chiropractors to the CRM.`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
