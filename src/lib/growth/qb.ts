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

async function all(realm: string, token: string, entity: string, fields: string): Promise<any[]> {
  const out: any[] = [];
  for (let start = 1; ; start += 1000) {
    const j = await query(realm, token, `select ${fields} from ${entity} STARTPOSITION ${start} MAXRESULTS 1000`);
    const rows = j?.QueryResponse?.[entity] || [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Marketplaces, house accounts and walk-in buckets — never emailed. */
const NOT_A_PERSON = /amazon|walmart|faire|ebay|etsy|shopify|square|paypal|cash (customer|sale)|walk[- ]?in|sample|test|unknown|misc/i;

export async function loadQbContacts(): Promise<Contact[]> {
  const t = await getQBTokens();
  if (!t) throw new Error("QuickBooks is not connected (qb_tokens refresh failed)");
  const [customers, invoices, receipts] = await Promise.all([
    all(t.realm_id, t.access_token, "Customer", "*"),
    all(t.realm_id, t.access_token, "Invoice", "Id, TxnDate, TotalAmt, CustomerRef"),
    all(t.realm_id, t.access_token, "SalesReceipt", "Id, TxnDate, TotalAmt, CustomerRef"),
  ]);

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
    });
  }
  return out;
}

/** "3oz PLUS Roll-On x24 and 4oz Tube x12" from the customer's most recent invoice. */
export async function lastOrderSummary(qbId: string): Promise<string | null> {
  try {
    const t = await getQBTokens();
    if (!t) return null;
    const j = await query(t.realm_id, t.access_token, `select * from Invoice where CustomerRef = '${qbId.replace(/'/g, "")}' ORDERBY TxnDate DESC MAXRESULTS 1`);
    const inv = j?.QueryResponse?.Invoice?.[0];
    const lines = (inv?.Line || [])
      .filter((l: any) => l.DetailType === "SalesItemLineDetail" && Number(l.Amount) > 0)
      .map((l: any) => {
        const name = String(l.SalesItemLineDetail?.ItemRef?.name || l.Description || "").split(":").pop()!.trim();
        const qty = Number(l.SalesItemLineDetail?.Qty || 0);
        return name && !/ship|freight|fee|discount|credit/i.test(name) ? `${name}${qty > 1 ? ` x${qty}` : ""}` : null;
      })
      .filter(Boolean) as string[];
    if (!lines.length) return null;
    const top = lines.slice(0, 2);
    return top.join(" and ") + (lines.length > 2 ? `, plus ${lines.length - 2} more` : "");
  } catch {
    return null;
  }
}
