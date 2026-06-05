// Shared affiliate commission logic. Pure functions over rows fetched with the
// service-role client, so both the affiliate dashboard and the admin views agree.

export type Affiliate = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  slug: string;
  commission_rate: number;   // 0.15 = 15%
  commission_rule: string;   // 'lifetime' | 'first_order' | '12_months'
  commission_base: string;   // 'subtotal' | 'total'
  status: string;            // 'active' | 'paused'
  notes: string | null;
  created_at: string;
};

type OrderRow = { id: string; customer_id: string; subtotal: number; total: number; status: string; created_at: string };
type CustomerRow = { id: string; created_at: string };

// Orders that count for commission under this affiliate's rule. `cancelled`
// orders never count. Within the rule, all non-cancelled orders are "eligible";
// payability (confirmed vs pending) is decided separately below.
export function eligibleOrders(orders: OrderRow[], customer: CustomerRow, aff: Affiliate): OrderRow[] {
  const active = orders.filter((o) => o.status !== "cancelled");
  if (aff.commission_rule === "first_order") {
    if (!active.length) return [];
    const earliest = [...active].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
    return [earliest];
  }
  if (aff.commission_rule === "12_months") {
    const cutoff = new Date(customer.created_at);
    cutoff.setFullYear(cutoff.getFullYear() + 1);
    return active.filter((o) => new Date(o.created_at) <= cutoff);
  }
  return active; // 'lifetime'
}

// A confirmed/shipped/delivered order is "payable"; a pending one is "pending".
export const isPayable = (status: string) => ["confirmed", "shipped", "delivered"].includes(status);

export function orderCommission(order: OrderRow, aff: Affiliate): number {
  const base = aff.commission_base === "total" ? Number(order.total) : Number(order.subtotal);
  return base * Number(aff.commission_rate);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
