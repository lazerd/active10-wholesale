// Import pro-shop club prospects (from scripts/club_prospects.csv) into the
// outreach_prospects table as type='club'. Dedupes by email against existing
// prospects AND customers. Reuses the same Supabase env as the app.
//
//   node scripts/import-club-prospects.mjs          # dry run (default)
//   node scripts/import-club-prospects.mjs --send    # actually insert
//
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIVE = process.argv.includes("--send");

// ── env (.env.local at app root) ────────────────────────────────────────────
const env = {};
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing Supabase env in .env.local"); process.exit(1); }
const sb = createClient(URL, KEY);

// ── minimal RFC-4180 CSV parser (handles quoted fields w/ commas) ───────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  const csv = parseCSV(readFileSync(path.join(__dirname, "club_prospects.csv"), "utf8"));
  const header = csv.shift().map((h) => h.trim().toLowerCase());
  const idx = (n) => header.indexOf(n);
  const recs = csv
    .filter((r) => r.length >= 4 && r[idx("email")])
    .map((r) => ({
      first: (r[idx("first")] || "").trim(),
      last: (r[idx("last")] || "").trim(),
      email: (r[idx("email")] || "").trim(),
      club: (r[idx("club")] || "").trim(),
      website: (r[idx("website")] || "").trim(),
    }));

  // existing emails to skip (prospects + customers)
  const skip = new Set();
  for (const table of ["outreach_prospects", "customers"]) {
    const { data, error } = await sb.from(table).select("email");
    if (error) { console.error(`read ${table}:`, error.message); continue; }
    for (const row of data || []) if (row.email) skip.add(row.email.toLowerCase());
  }

  const seen = new Set();
  const toInsert = [];
  let dupExisting = 0, dupFile = 0;
  for (const r of recs) {
    const key = r.email.toLowerCase();
    if (skip.has(key)) { dupExisting++; continue; }
    if (seen.has(key)) { dupFile++; continue; }
    seen.add(key);
    toInsert.push({
      name: `${r.first} ${r.last}`.trim(),
      business: r.club,
      email: r.email,
      website: r.website || null,
      type: "club",
      channel: "email",
      source: "dca",
      status: "prospected",
    });
  }

  console.log(`Parsed:            ${recs.length}`);
  console.log(`Skip (existing):   ${dupExisting}`);
  console.log(`Skip (dupe in file): ${dupFile}`);
  console.log(`To insert:         ${toInsert.length}`);
  console.log(toInsert.slice(0, 5).map((p) => `  ${p.business} <${p.email}>`).join("\n"));

  if (!LIVE) { console.log("\nDRY RUN — re-run with --send to insert."); return; }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error } = await sb.from("outreach_prospects").insert(chunk);
    if (error) { console.error("insert error:", error.message); break; }
    inserted += chunk.length;
  }
  console.log(`\nInserted ${inserted} club prospects.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
