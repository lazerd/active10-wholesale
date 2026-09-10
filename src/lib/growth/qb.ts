import { getQBTokens } from "@/app/api/qb/lib";
import { firstEmail } from "./config";

/**
 * QuickBooks is the real customer history — 2,300 customers and every invoice
 * back to 2016. The portal's own `orders` table only starts in March 2026 and
 * knows about ~20 buyers, so reorder cadence and lapse are computed from QB.
 */
export type Contact = {
  qbId: string;
  email: string;
  display: string;
  given: string | null;
  family: string | null;
  company: string | null;
  lastDate: string | null;   // YYYY-MM-DD of the most recent invoice / sales receipt
  orders: number;
  spent: number;
  gapDays: number | null;    // median days between orders (2+ orders)
  retail: boolean;           // a getactive10.com shopper (QB note "shopify"/"website", taxed, no company)
};

const BASE = process.env.QB_ENVIRONMENT === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";

async function query(realm: string, token: string, sql: string): Promise<any> {
  const res = await fetch(`${BASE}/v3/company/${realm}/query?query=${encodeURIComponent(sql)}&minorversion=65`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`QuickBooks ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Page specs for an entity — counted first so every page can be fetched at once. */
async function pages(realm: string, token: string, entity: string, fields: string) {
  const j = await query(realm, token, `select count(*) from ${entity}`);
  const total = Number(j?.QueryResponse?.totalCount || 0);
  return Array.from({ length: Math.max(1, Math.ceil(total / 1000)) }, (_, i) => ({
    entity, sql: `select ${fields} from ${entity} STARTPOSITION ${i * 1000 + 1} MAXRESULTS 1000`,
  }));
}

/**
 * Fetch pages in parallel, 6 at a time (QuickBooks allows 10 concurrent per
 * company). Fetched one after another this took 52s and blew the function budget.
 */
async function fetchPages(realm: string, token: string, specs: { entity: string; sql: string }[]) {
  const out: Record<string, any[]> = {};
  let next = 0;
  const worker = async () => {
    while (next < specs.length) {
      const s = specs[next++];
      const j = await query(realm, token, s.sql);
      (out[s.entity] ||= []).push(...(j?.QueryResponse?.[s.entity] || []));
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, specs.length) }, worker));
  return out;
}

/** Marketplaces, house accounts and walk-in buckets — never emailed. */
const NOT_A_PERSON = /amazon|walmart|faire|ebay|etsy|shopify|square|paypal|cash (customer|sale)|walk[- ]?in|sample|test|unknown|misc/i;

export async function loadQbContacts(): Promise<Contact[]> {
  const t = await getQBTokens();
  if (!t) throw new Error("QuickBooks is not connected (qb_tokens refresh failed)");
  const specs = (await Promise.all([
    pages(t.realm_id, t.access_token, "Customer", "*"),
    pages(t.realm_id, t.access_token, "Invoice", "Id, TxnDate, TotalAmt, CustomerRef"),
    pages(t.realm_id, t.access_token, "SalesReceipt", "Id, TxnDate, TotalAmt, CustomerRef"),
  ])).flat();
  const got = await fetchPages(t.realm_id, t.access_token, specs);
  const customers = got.Customer || [], invoices = got.Invoice || [], receipts = got.SalesReceipt || [];

  const dates: Record<string, string[]> = {};
  const spent: Record<string, number> = {};
  for (const x of [...invoices, ...receipts]) {
    const id = x?.CustomerRef?.value;
    if (!id || !x.TxnDate) continue;
    (dates[id] ||= []).push(x.TxnDate);
    spent[id] = (spent[id] || 0) + Number(x.TotalAmt || 0);
  }

  const out: Contact[] = [];
  const seen = new Set<string>();
  for (const c of customers) {
    if (c.Active === false) continue;
    const email = firstEmail(c?.PrimaryEmailAddr?.Address);
    if (!email || seen.has(email)) continue;
    const display = String(c.DisplayName || c.CompanyName || "").trim();
    if (NOT_A_PERSON.test(display)) continue;
    seen.add(email);
    const ds = (dates[c.Id] || []).sort();
    // Orders on the same day (invoice + receipt) count once for cadence.
    const uniq = Array.from(new Set(ds));
    let gap: number | null = null;
    if (uniq.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < uniq.length; i++) gaps.push((Date.parse(uniq[i]) - Date.parse(uniq[i - 1])) / 86400000);
      gaps.sort((a, b) => a - b);
      gap = Math.round(gaps[Math.floor(gaps.length / 2)]);
    }
    out.push({
      qbId: String(c.Id), email, display,
      given: c.GivenName || null, family: c.FamilyName || null, company: c.CompanyName || null,
      lastDate: uniq.length ? uniq[uniq.length - 1] : null,
      orders: uniq.length, spent: Math.round((spent[c.Id] || 0) * 100) / 100, gapDays: gap,
      retail: /shopify|website|amazon|retail/i.test(String(c.Notes || "")) ||
        (c.Taxable === true && !c.CompanyName && !/^dr\.?\s|\bd\.?c\.?\b/i.test(display)),
    });
  }
  return out;
}

/**
 * "Active 10 PLUS Pump x3 and Active 10 PLUS Roll-On x4" from the customer's
 * most recent invoice. QuickBooks item names are SKU codes ("033"), so they are
 * translated through the portal's products table (qb_sku → name). A line that
 * can't be named is left out rather than printed as a code.
 */
export async function lastOrderSummary(qbId: string, skuNames: Record<string, string>): Promise<string | null> {
  try {
    const t = await getQBTokens();
    if (!t) return null;
    const j = await query(t.realm_id, t.access_token, `select * from Invoice where CustomerRef = '${qbId.replace(/'/g, "")}' ORDERBY TxnDate DESC MAXRESULTS 1`);
    const inv = j?.QueryResponse?.Invoice?.[0];
    const lines = (inv?.Line || [])
      .filter((l: any) => l.DetailType === "SalesItemLineDetail" && Number(l.Amount) > 0)
      .map((l: any) => {
        const ref = String(l.SalesItemLineDetail?.ItemRef?.name || "");
        const sku = ref.split(":").pop()!.trim().toLowerCase();
        const name = skuNames[sku] || (/[a-z]{3,}/i.test(ref) && !/^\d/.test(sku) ? sku : null);
        const qty = Number(l.SalesItemLineDetail?.Qty || 0);
        return name && !/ship|freight|fee|discount|credit|sample/i.test(name) ? `${name}${qty > 1 ? ` x${qty}` : ""}` : null;
      })
      .filter(Boolean) as string[];
    if (!lines.length) return null;
    const top = lines.slice(0, 2);
    return top.join(" and ") + (lines.length > 2 ? `, plus ${lines.length - 2} more` : "");
  } catch {
    return null;
  }
}
