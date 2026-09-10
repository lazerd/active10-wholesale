import { SupabaseClient } from "@supabase/supabase-js";
import { FREE_MAIL, Settings, fetchAll } from "./config";

/**
 * Keeps the cold-chiro lane stocked. One city per tick: Brave search →
 * practice sites → the address the practice publishes on its own site →
 * Gemini cleans the practice name and doctor's surname (so the letter can say
 * "Dr. Olson," instead of a page title). Anything that isn't clearly one
 * practice's own site is dropped rather than emailed badly.
 */
export const CITIES = [
  "Sacramento CA", "Fresno CA", "Santa Rosa CA", "San Jose CA", "Oakland CA", "Long Beach CA", "Irvine CA", "Riverside CA", "Bakersfield CA", "Santa Barbara CA",
  "Pasadena CA", "Torrance CA", "Temecula CA", "Carlsbad CA", "Chico CA", "Redding CA", "Reno NV", "Henderson NV", "Tucson AZ", "Scottsdale AZ",
  "Mesa AZ", "Flagstaff AZ", "Salt Lake City UT", "Provo UT", "St. George UT", "Ogden UT", "Colorado Springs CO", "Fort Collins CO", "Boulder CO", "Aurora CO",
  "Spokane WA", "Tacoma WA", "Bellevue WA", "Vancouver WA", "Eugene OR", "Bend OR", "Salem OR", "Medford OR", "Coeur d'Alene ID", "Missoula MT",
  "Billings MT", "Bozeman MT", "Cheyenne WY", "Rapid City SD", "Sioux Falls SD", "Fargo ND", "Lincoln NE", "Des Moines IA", "Cedar Rapids IA", "Madison WI",
  "Milwaukee WI", "Green Bay WI", "St. Paul MN", "Rochester MN", "Duluth MN", "Wichita KS", "Overland Park KS", "Tulsa OK", "Oklahoma City OK", "Little Rock AR",
  "Springfield MO", "St. Louis MO", "Columbia MO", "Memphis TN", "Knoxville TN", "Chattanooga TN", "Franklin TN", "Louisville KY", "Lexington KY", "Cincinnati OH",
  "Columbus OH", "Cleveland OH", "Dayton OH", "Toledo OH", "Ann Arbor MI", "Lansing MI", "Kalamazoo MI", "Traverse City MI", "Fort Wayne IN", "Carmel IN",
  "Naperville IL", "Peoria IL", "Champaign IL", "Pittsburgh PA", "Harrisburg PA", "Lancaster PA", "Allentown PA", "Buffalo NY", "Rochester NY", "Albany NY",
  "Syracuse NY", "White Plains NY", "Stamford CT", "Hartford CT", "Providence RI", "Worcester MA", "Portland ME", "Burlington VT", "Manchester NH", "Princeton NJ",
  "Morristown NJ", "Wilmington DE", "Annapolis MD", "Frederick MD", "Richmond VA", "Virginia Beach VA", "Charlottesville VA", "Raleigh NC", "Charlotte NC", "Asheville NC",
  "Wilmington NC", "Greenville SC", "Charleston SC", "Columbia SC", "Savannah GA", "Athens GA", "Alpharetta GA", "Jacksonville FL", "Tampa FL", "Sarasota FL",
  "Orlando FL", "Naples FL", "Fort Lauderdale FL", "Boca Raton FL", "Tallahassee FL", "Pensacola FL", "Mobile AL", "Huntsville AL", "Birmingham AL", "Baton Rouge LA",
  "Lafayette LA", "Jackson MS", "Plano TX", "Frisco TX", "Fort Worth TX", "Houston TX", "The Woodlands TX", "San Antonio TX", "El Paso TX", "Lubbock TX",
  "Amarillo TX", "Corpus Christi TX", "Waco TX", "Santa Fe NM", "Las Cruces NM", "Anchorage AK", "Honolulu HI", "Kailua HI",
];

const SKIP_HOSTS = [
  "yelp.", "yellowpages.", "facebook.", "instagram.", "linkedin.", "mapquest.", "healthgrades.", "zocdoc.", "wellness.com", "chiropractic.org",
  "ratemds.", "indeed.", "ziprecruiter.", "bbb.org", "tripadvisor.", "youtube.", "wikipedia.", "amazon.", "groupon.", "nextdoor.", "apple.com",
  "google.", "vitals.com", "webmd.", "thejoint.com", "chirotouch", "birdeye.", "local.", "manta.", "angi.", "thumbtack.", "reddit.", "npiprofile", "sharecare.",
];
const BAD_LOCAL = ["no-reply", "noreply", "donotreply", "postmaster", "abuse", "privacy", "webmaster", "support", "billing", "careers", "jobs", "hr"];
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

async function brave(q: string) {
  const r = await fetch("https://api.search.brave.com/res/v1/web/search?count=20&q=" + encodeURIComponent(q), {
    headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY || "" }, cache: "no-store",
  });
  if (!r.ok) throw new Error(`Brave ${r.status}`);
  const j = await r.json();
  return (j.web?.results || []).map((x: any) => ({ title: String(x.title || ""), url: String(x.url || "") }));
}

async function page(url: string, ms: number): Promise<string> {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; Active10/1.0)" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
    return r.ok ? (await r.text()).slice(0, 400000) : "";
  } catch { return ""; }
}

function pickEmail(html: string, host: string): string | null {
  const found = (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map((x) => x.toLowerCase());
  const ok = found.filter((e) =>
    !/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e) && !/(sentry|wixpress|example|domain|yourname|placeholder|godaddy|squarespace|wordpress)\./.test(e) &&
    !BAD_LOCAL.some((b) => e.startsWith(b + "@")));
  // Prefer the practice's own domain over a stray address in a footer.
  return ok.find((e) => e.endsWith("@" + host)) || ok[0] || null;
}

const textOf = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

function heuristicName(title: string): string | null {
  const segs = title.split(/\s[|–—-]\s|\|/).map((x) => x.trim()).filter(Boolean);
  const seg = segs.find((x) => /chiro|spine|wellness|health|sport|rehab/i.test(x) && !/^(best |top |chiropractor in|chiropractors? near)/i.test(x)) || "";
  return seg && seg.length <= 50 ? seg : null;
}

async function clean(title: string, text: string): Promise<{ ok: boolean; business: string | null; last: string | null }> {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    const prompt = `A web search for chiropractors returned this site.\nTITLE: ${title}\nPAGE TEXT: ${text.slice(0, 2500)}\n\nReturn JSON {"is_single_practice": boolean, "practice_name": string|null, "doctor_last_name": string|null}.\n- is_single_practice: true only if this is ONE independent chiropractic / sports-chiro practice's own website (not a directory, article, franchise corporate page, school, or hospital system).\n- practice_name: the name the practice uses for itself, short, no city or tagline (e.g. "Nokomis Chiropractic").\n- doctor_last_name: the owner/lead chiropractor's surname ONLY if the page clearly names one doctor as the practice's chiropractor; null if several or unclear.`;
    for (const model of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) continue;
        const j = await r.json();
        const p = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        const business = typeof p.practice_name === "string" && p.practice_name.length <= 60 ? p.practice_name.trim() : null;
        const last = typeof p.doctor_last_name === "string" && /^[A-Za-z' -]{2,25}$/.test(p.doctor_last_name) ? p.doctor_last_name.trim() : null;
        return { ok: !!p.is_single_practice && !!business, business, last };
      } catch { /* next model */ }
    }
  }
  const business = heuristicName(title);
  return { ok: !!business, business, last: null };
}

export async function discover(sb: SupabaseClient, s: Settings, deadline: number) {
  if (!process.env.BRAVE_API_KEY) return { skipped: "no BRAVE_API_KEY" };
  const { count } = await sb.from("outreach_prospects").select("id", { count: "exact", head: true })
    .eq("type", "chiropractor").eq("status", "prospected").eq("source", "growth discovery");
  if ((count || 0) >= 60) return { skipped: "buffer full", buffer: count };

  const city = CITIES[s.city_cursor % CITIES.length];
  await sb.from("growth_settings").update({ city_cursor: s.city_cursor + 1 }).eq("id", "default");

  const [prospects, customers] = await Promise.all([
    fetchAll<any>(() => sb.from("outreach_prospects").select("email, website")),
    fetchAll<any>(() => sb.from("customers").select("email")),
  ]);
  const haveEmail = new Set<string>(), haveHost = new Set<string>();
  for (const p of prospects) { if (p.email) haveEmail.add(p.email.toLowerCase()); const h = hostOf(p.website || ""); if (h) haveHost.add(h); }
  for (const c of customers) { const e = (c.email || "").toLowerCase(); if (!e) continue; haveEmail.add(e); const d = e.split("@")[1]; if (d && !FREE_MAIL.has(d)) haveHost.add(d); }

  const results = await brave(`chiropractor ${city}`);
  let added = 0, looked = 0;
  for (const r of results) {
    if (Date.now() > deadline) break;
    const host = hostOf(r.url);
    if (!host || haveHost.has(host) || SKIP_HOSTS.some((x) => host.includes(x))) continue;
    haveHost.add(host);
    looked++;
    const home = await page(`https://${host}`, 6000);
    if (!home) continue;
    let email = pickEmail(home, host);
    if (!email) for (const p of ["/contact", "/contact-us"]) { if (Date.now() > deadline) break; email = pickEmail(await page(`https://${host}${p}`, 5000), host); if (email) break; }
    if (!email || haveEmail.has(email)) continue;
    const title = (home.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || r.title).trim();
    const c = await clean(title, textOf(home));
    if (!c.ok || !c.business) continue;
    haveEmail.add(email);
    const { error } = await sb.from("outreach_prospects").insert({
      name: c.last ? `Dr. ${c.last}` : null, business: c.business, email, website: `https://${host}`, city,
      type: "chiropractor", source: "growth discovery", status: "prospected", channel: "email", touch_count: 0,
    });
    if (!error) added++;
  }
  return { city, looked, added, buffer: (count || 0) + added };
}
