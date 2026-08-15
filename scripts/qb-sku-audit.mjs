#!/usr/bin/env node
/**
 * READ-ONLY audit of the QuickBooks item mapping used by /api/qb/create-invoice.
 *
 * Replicates that route's lookup logic exactly against the live QuickBooks
 * company file and reports, per product, which QB inventory item an invoice
 * line would actually hit. Makes no writes to QuickBooks.
 *
 *   node scripts/qb-sku-audit.mjs             # audit the whole catalog
 *   node scripts/qb-sku-audit.mjs ORD-1066    # also dry-run a specific order
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sb = async (p, init) => (await fetch(`${SB}/rest/v1/${p}`, { headers: H, ...init })).json();

// --- QuickBooks tokens (mirrors src/app/api/qb/lib.ts) ---------------------
const [tok] = await sb("qb_tokens?select=*&id=eq.default");
if (!tok) { console.error("QuickBooks not connected (no qb_tokens row)."); process.exit(1); }
let accessToken = tok.access_token;
if (new Date(tok.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`).toString("base64")}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token }),
  });
  if (!r.ok) { console.error("QB token refresh failed:", await r.text()); process.exit(1); }
  const nt = await r.json();
  accessToken = nt.access_token;
  await fetch(`${SB}/rest/v1/qb_tokens?id=eq.default`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({
      access_token: nt.access_token, refresh_token: nt.refresh_token,
      expires_at: new Date(Date.now() + nt.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  console.log("(refreshed QuickBooks access token)\n");
}
const QB_BASE = env.QB_ENVIRONMENT === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";
const qb = async (q) => {
  const r = await fetch(`${QB_BASE}/v3/company/${tok.realm_id}/query?query=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`QB ${r.status}: ${await r.text()}`);
  return r.json();
};

// --- Pull live QB items ----------------------------------------------------
const items = (await qb("SELECT * FROM Item MAXRESULTS 1000"))?.QueryResponse?.Item || [];
console.log(`QuickBooks company ${tok.realm_id} — ${items.length} items\n`);

// Mirror the route's index: Name / Sku / FullyQualifiedName, exact and
// case-sensitive, with any key claimed by two items marked AMBIGUOUS.
const lookup = {};
const collisions = [];
const put = (k, item, field) => {
  if (k === undefined || k === null || k === "") return;
  const key = String(k);
  const cur = lookup[key];
  if (cur && cur !== "AMBIGUOUS" && cur.ref.Id !== item.Id) {
    collisions.push({ key, a: cur, b: { ref: { Id: item.Id, Name: item.Name }, field } });
    lookup[key] = "AMBIGUOUS";
    return;
  }
  if (!cur) lookup[key] = { ref: { Id: item.Id, Name: item.Name }, field };
};
for (const it of items) {
  put(it.Name, it, "Name");
  put(it.Sku, it, "Sku");
  put(it.FullyQualifiedName, it, "FullyQualifiedName");
}

// --- Resolve exactly the way create-invoice does ---------------------------
const resolve = (sku) => {
  if (!sku) return { hit: null, ambiguous: false };
  const v = lookup[sku];
  if (v === "AMBIGUOUS") return { hit: null, ambiguous: true };
  return { hit: v || null, ambiguous: false };
};

const byId = Object.fromEntries(items.map((i) => [i.Id, i]));
const products = await sb("products?select=id,name,qb_sku,active&order=sort_order");

// Must mirror BUNDLES in src/app/api/qb/create-invoice/route.ts
const BUNDLES = {
  "dca-intro-kit": [
    { sku: "030", qty: 3, label: "Active 10 PLUS Tube", weight: 19.98 },
    { sku: "032", qty: 3, label: "Active 10 PLUS Roll-On", weight: 19.98 },
    { sku: "011a", qty: 10, label: "Active 10 PLUS Sample Packet", weight: 0.65 },
  ],
};
const round2 = (n) => Math.round(n * 100) / 100;
const expand = (productId, name, qty, unitPrice) => {
  const lineTotal = round2(qty * round2(unitPrice));
  const b = BUNDLES[productId];
  if (!b) return null;
  const tw = b.reduce((s, c) => s + c.qty * c.weight, 0);
  let allocated = 0;
  return b.map((c, i) => {
    const amount = i === b.length - 1 ? round2(lineTotal - allocated) : round2((lineTotal * (c.qty * c.weight)) / tw);
    allocated = round2(allocated + amount);
    return { sku: c.sku, description: `${name} — ${c.label}`, qty: c.qty * qty, amount };
  });
};

console.log("PRODUCT                     SKU    →  QUICKBOOKS ITEM                    TYPE          QTY   VERDICT");
console.log("─".repeat(118));
const problems = [];
for (const p of products) {
  if (BUNDLES[p.id]) {
    const comps = BUNDLES[p.id];
    const bad = comps.filter((c) => !resolve(c.sku).hit);
    console.log(
      `${p.name}`.padEnd(28) + `KIT    →  expands into ${comps.length} component lines`.padEnd(50) +
      (bad.length ? `❌ missing QB item: ${bad.map((c) => c.sku).join(", ")}` : "OK — all components inventory-tracked")
    );
    for (const c of comps) {
      const ci = resolve(c.sku).hit ? byId[resolve(c.sku).hit.ref.Id] : null;
      console.log(`   └─ ${String(c.qty).padStart(2)}x ${c.label.padEnd(30)} sku ${c.sku.padEnd(5)} ${ci ? `[${ci.Type}, ${ci.QtyOnHand} on hand]` : "*** NOT IN QUICKBOOKS ***"}`);
    }
    if (bad.length) problems.push({ p, verdict: `kit component(s) missing in QB: ${bad.map((c) => c.sku).join(", ")}` });
    continue;
  }
  const { hit, ambiguous } = resolve(p.qb_sku);
  const it = hit ? byId[hit.ref.Id] : null;
  const type = it ? it.Type : "—";
  const qty = it && it.QtyOnHand !== undefined ? String(it.QtyOnHand) : "—";
  let verdict;
  if (!p.qb_sku) verdict = "NO SKU — invoice will be blocked";
  else if (ambiguous) verdict = "AMBIGUOUS — two QB items share this key";
  else if (!hit) verdict = "NO MATCH — invoice will be blocked";
  else if (it && it.Type !== "Inventory") verdict = `OK (${it.Type} — not inventory-tracked)`;
  else verdict = "OK";
  if (!verdict.startsWith("OK")) problems.push({ p, verdict, hit });
  console.log(
    `${(p.active ? "" : "(off) ") + p.name}`.padEnd(28) +
    `${String(p.qb_sku ?? "—").padEnd(6)} →  ${(it ? it.Name : "—").padEnd(34)} ${type.padEnd(13)} ${qty.padEnd(5)} ${verdict}`
  );
}

if (collisions.length) {
  console.log(`\n⚠  ${collisions.length} ambiguous key(s) — one key claimed by two QB items:`);
  for (const c of collisions) {
    console.log(`   "${c.key}": Id ${c.a.ref.Id} "${c.a.ref.Name}" (via ${c.a.field}) ` +
                `vs Id ${c.b.ref.Id} "${c.b.ref.Name}" (via ${c.b.field})`);
  }
}
if (problems.length) {
  console.log(`\n${problems.length} product(s) need attention:`);
  for (const x of problems) console.log(`   • ${x.p.name} (sku ${x.p.qb_sku ?? "none"}): ${x.verdict}`);
} else {
  console.log("\n✅ every product maps to exactly one QuickBooks item.");
}

// --- Optional: dry-run one order ------------------------------------------
const orderNum = process.argv[2];
if (orderNum) {
  const [o] = await sb(`orders?select=*&order_number=eq.${encodeURIComponent(orderNum)}`);
  if (!o) { console.error(`\nNo order ${orderNum}`); process.exit(1); }
  const skuMap = Object.fromEntries(products.filter((p) => p.qb_sku).map((p) => [p.id, p.qb_sku]));
  console.log(`\n\nDRY RUN — invoice lines ${orderNum} would post to QuickBooks:`);
  console.log("─".repeat(118));
  let bad = 0;
  let n = 0;
  for (const line of o.items || []) {
    const parts = expand(line.product_id, line.name, line.qty, line.unit_price)
      || [{ sku: skuMap[line.product_id], description: line.name, qty: line.qty, amount: round2(line.qty * line.unit_price) }];
    if (parts.length > 1) console.log(`  (kit "${line.name}" x${line.qty} expands to ${parts.length} lines)`);
    for (const part of parts) {
      const { hit } = resolve(part.sku);
      const it = hit ? byId[hit.ref.Id] : null;
      if (!it) bad++;
      console.log(
        `  ${++n}. ${String(part.qty).padStart(2)}x ${part.description.padEnd(40)} sku=${String(part.sku ?? "—").padEnd(5)} $${part.amount.toFixed(2).padStart(7)} ` +
        `→ ItemRef ${it ? `${it.Id} "${it.Name}" [${it.Type}]` : "*** NONE — no inventory hit ***"}${it ? "" : "  ⚠"}`
      );
    }
  }
  console.log(`\n  ${bad === 0 ? "✅ every line maps to an exact SKU match on a QuickBooks item."
    : `❌ ${bad} line(s) would NOT hit the right inventory item.`}`);
  console.log(`  qb_invoice_id currently: ${o.qb_invoice_id || "none (not yet invoiced)"}`);
}
