import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

// Directories / socials we don't want as practice "websites".
const DENY_HOST = ["yelp.", "facebook.", "instagram.", "mapquest.", "threebestrated.", "healthgrades.", "zocdoc.", "yellowpages.", "bbb.org", "linkedin.", "tripadvisor.", "ratemds.", "vitals.", "wikipedia.", "reddit.", "amazon.", "indeed.", "glassdoor.", "google.", "bing.", "duckduckgo.", "apple.", "youtube.", ".gov"];
// Junk email domains that show up in page source (analytics, builders, agencies).
const DENY_EMAIL = ["sentry", "wixpress", "example.com", "godaddy", "schema.org", "w3.org", "googleapis", "cloudflare", "jquery", "fontawesome", "squarespace", "wordpress", "sentry.io", "@2x", ".png", ".jpg", ".gif", ".svg", ".webp"];

const fetchT = async (url: string, ms = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctrl.signal, redirect: "follow" });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
};

const registrable = (host: string) => host.replace(/^www\./, "").split(".").slice(-2).join(".");

function extractEmails(html: string, siteHost: string): string[] {
  const found = (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map((e) => e.toLowerCase());
  const dom = registrable(siteHost);
  const clean = found.filter((e) => !DENY_EMAIL.some((d) => e.includes(d)) && !/\.(png|jpg|jpeg|gif|svg|webp)$/.test(e));
  // Prefer emails on the practice's own domain.
  const onDomain = clean.filter((e) => e.split("@")[1].endsWith(dom));
  const ranked = (onDomain.length ? onDomain : clean).sort((a, b) => {
    const score = (x: string) => (/^(info|office|hello|contact|admin|frontdesk|reception)@/.test(x) ? 0 : 1);
    return score(a) - score(b);
  });
  return Array.from(new Set(ranked));
}

function titleOf(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

function candidateHosts(urls: string[]): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    try {
      const h = new URL(u).hostname.toLowerCase();
      if (DENY_HOST.some((d) => h.includes(d))) continue;
      const reg = registrable(h);
      if (seen.has(reg)) continue;
      seen.add(reg);
      hosts.push(`https://${h}`);
    } catch {}
  }
  return hosts.slice(0, 10);
}

// Brave Search API — works from server IPs (proper API, not scraping). Preferred.
async function braveSearch(query: string): Promise<string[]> {
  try {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`, {
      headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY || "" },
    });
    if (!r.ok) { console.error("Brave search failed:", r.status, await r.text()); return []; }
    const d = await r.json();
    return candidateHosts((d.web?.results || []).map((x: any) => x.url).filter(Boolean));
  } catch (e) { console.error("Brave search error", e); return []; }
}

// DuckDuckGo HTML fallback (often blocked from datacenter IPs).
async function ddgSearch(query: string): Promise<string[]> {
  const html = await fetchT(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 9000);
  const urls = Array.from(html.matchAll(/uddg=([^&"']+)/g)).map((m) => { try { return decodeURIComponent(m[1]); } catch { return ""; } });
  return candidateHosts(urls);
}

async function scrapeSite(base: string, city: string, type: string) {
  const root = await fetchT(base);
  if (!root) return null;
  const host = new URL(base).hostname;
  let emails = extractEmails(root, host);
  let title = titleOf(root);
  // Try a contact page if the homepage had nothing on-domain.
  if (!emails.length) {
    for (const path of ["/contact", "/contact-us", "/contactus", "/about"]) {
      const page = await fetchT(base.replace(/\/$/, "") + path, 6000);
      if (page) { const e = extractEmails(page, host); if (e.length) { emails = e; break; } }
    }
  }
  if (!emails.length) return null;
  return { business: title || registrable(host), email: emails[0], website: base, city, type, source: "web scrape" };
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { query, urls, type = "chiropractor", city = "" } = await req.json();

    let sites: string[] = [];
    if (Array.isArray(urls) && urls.length) {
      sites = urls.map((u: string) => (u.startsWith("http") ? u : `https://${u}`)).slice(0, 10);
    } else if (query) {
      sites = process.env.BRAVE_API_KEY ? await braveSearch(query) : await ddgSearch(query);
      if (!sites.length && process.env.BRAVE_API_KEY) sites = await ddgSearch(query); // fallback if Brave returns nothing
    } else {
      return NextResponse.json({ error: "Provide a search query or a list of URLs." }, { status: 400 });
    }
    if (!sites.length) return NextResponse.json({ ok: true, added: 0, found: [], note: "Search returned no practice sites (search engines sometimes block server requests — try pasting practice URLs directly)." });

    // Existing emails to dedupe against (customers + prospects)
    const [{ data: custs }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("customers").select("email"),
      supabaseAdmin.from("outreach_prospects").select("email, website"),
    ]);
    const known = new Set<string>();
    (custs || []).forEach((c) => c.email && known.add(c.email.toLowerCase()));
    (existing || []).forEach((p) => { if (p.email) known.add(p.email.toLowerCase()); });

    const results = await Promise.all(sites.map((s) => scrapeSite(s, city, type).catch(() => null)));
    const fresh: any[] = [];
    for (const r of results) {
      if (!r || !r.email) continue;
      if (known.has(r.email.toLowerCase())) continue;
      known.add(r.email.toLowerCase());
      fresh.push(r);
    }

    if (fresh.length) {
      const { data: inserted } = await supabaseAdmin.from("outreach_prospects").insert(fresh.map((f) => ({ ...f, status: "prospected" }))).select();
      return NextResponse.json({ ok: true, added: inserted?.length || 0, found: inserted || [] });
    }
    return NextResponse.json({ ok: true, added: 0, found: [], note: "Scanned sites but found no new public emails on their own domains." });
  } catch (err: any) {
    console.error("outreach/scrape error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
