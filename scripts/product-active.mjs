#!/usr/bin/env node
/**
 * Show / hide products in the wholesale storefront.
 *
 * The storefront catalog is the Supabase `products` table (page.tsx fetches
 * `products` where active = true). Editing source files does NOT take a product
 * off the store — this script is the only way.
 *
 *   node scripts/product-active.mjs                        # list the catalog
 *   node scripts/product-active.mjs off original-jar-2oz   # hide from the store
 *   node scripts/product-active.mjs on  original-jar-2oz   # put it back
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

const list = async () => {
  const r = await fetch(`${URL_}/rest/v1/products?select=id,name,active,cat,retail,qb_sku&order=sort_order`, { headers: H });
  const rows = await r.json();
  console.log("\n  ON/OFF  ID                    NAME                             SKU    RETAIL");
  for (const p of rows) {
    console.log(
      `  ${p.active ? "  ON  " : " off  "}  ${String(p.id).padEnd(20)}  ${String(p.name).padEnd(31)}  ${String(p.qb_sku ?? "—").padEnd(5)}  $${p.retail}`
    );
  }
  console.log(`\n  ${rows.filter((p) => p.active).length} of ${rows.length} products live on the storefront.\n`);
};

const [cmd, id] = process.argv.slice(2);
if (!cmd) {
  await list();
} else if (["on", "off"].includes(cmd) && id) {
  const active = cmd === "on";
  const r = await fetch(`${URL_}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ active }),
  });
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(`No product with id "${id}". Run with no arguments to list valid ids.`);
    process.exit(1);
  }
  console.log(`${rows[0].name} is now ${active ? "LIVE on the storefront" : "HIDDEN from the storefront"}.`);
  console.log("Takes effect on the customer's next page load — no deploy needed.");
} else {
  console.error("Usage: node scripts/product-active.mjs [on|off <product-id>]");
  process.exit(1);
}
