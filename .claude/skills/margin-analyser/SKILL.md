---
name: margin-analyser
description: Unit economics per Active 10 product (wholesale and retail) and what a 5% (or any) price change does to volume and profit. Use when Darrin asks about margins, pricing, which SKUs make money, or price increases.
---

# /margin-analyser

Read `.claude/active10-context.md` first.

## Per-product unit economics

1. **Catalog + list price** — `select id, name, cat, retail, qb_sku, active from products order by sort_order;`
   Wholesale price = 50% of retail before tier discounts.
2. **Realised wholesale price** — what customers actually paid after tiers/codes:
   ```sql
   select i->>'name' as product, sum((i->>'qty')::int) as units,
          sum((i->>'line_total')::numeric) as revenue,
          sum((i->>'line_total')::numeric)/nullif(sum((i->>'qty')::int),0) as avg_unit_price
   from orders, jsonb_array_elements(items) i
   where status <> 'cancelled' and created_at > now() - interval '12 months'
   group by 1 order by revenue desc;
   ```
3. **Retail (Shopify) units + revenue** — `qbo_accounting_get_sales_by_product_summary`, last 12 months.
4. **Unit cost** — `qbo_accounting_get_product_service_list` (purchase cost per item). If cost is
   missing for a SKU, ask Darrin rather than guessing, and mark the row incomplete.
5. **Per-unit costs that aren't COGS** — payment fees (`orders.cc_fee`: 2.99% on `card`, 1% on `ach`, passed to the customer — note whether that makes them a wash), Shopify
   fees, average shipping per order from the P&L. Allocate per unit and say how.

Report per product and channel: price, unit cost, gross margin $ and %, contribution margin
after fees/shipping, units, total contribution.

## Price-change scenario

For a given change (default +5%), per product:
`new contribution = (P×(1+Δ) − cost) × units × (1 + elasticity×Δ)`.
Show three elasticities (−0.5 sticky, −1.0 neutral, −2.0 sensitive) and the **break-even volume
drop**: the % of units you can lose before profit falls (`Δ / (margin% + Δ)`).
Note that wholesale tiers ($150/$300/$1,000) shift when prices rise — customers may cross into
a higher tier sooner — and that a retail change also moves the wholesale price (50% of retail)
and the reseller's margin story.

## Output

Table per product, the scenario table, and 3 sentences: best-margin SKU, worst, and the
recommendation. Read-only — never edit `products.retail` (that changes live prices).
