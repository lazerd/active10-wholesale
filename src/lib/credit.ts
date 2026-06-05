// Store-credit balance math over the customer_credits ledger.
// Positive rows = grants (pending/available/expired). Negative = redemptions.
export type CreditRow = { amount: number; kind: string; status: string; expires_at: string | null };

export function balances(rows: CreditRow[]) {
  const now = Date.now();
  let available = 0;
  let pending = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.kind === "redemption" || amt < 0) {
      available += amt; // negative — reduces the pool
    } else {
      const expired = r.expires_at ? new Date(r.expires_at).getTime() < now : false;
      if (r.status === "pending") pending += amt;
      else if (r.status === "available" && !expired) available += amt;
    }
  }
  return { available: Math.max(0, Math.round(available * 100) / 100), pending: Math.max(0, Math.round(pending * 100) / 100) };
}
