# active10-wholesale

## The product catalog lives in the DATABASE, not in source

`src/app/page.tsx` builds the storefront from the Supabase `products` table:

```ts
supabase.from("products").select("*").eq("active", true).order("sort_order")
```

There is **no product list in the code** that the app reads. To take a product off
the store (out of stock, discontinued), flip its `active` flag:

```bash
node scripts/product-active.mjs              # list every product + on/off state
node scripts/product-active.mjs off <id>     # remove from the storefront
node scripts/product-active.mjs on  <id>     # put it back
```

It takes effect on the next page load — no deploy, no code change.

**History:** the 2oz Original Jar was "removed" in commit `1134512` (2026-06-22) by
deleting it from `src/lib/products.ts` — a file nothing imports. The DB row stayed
`active = true`, so the jar kept selling for seven weeks (ORD-1066, Aug 13) while
the code looked like it had been pulled. `src/lib/products.ts` has been deleted so
this cannot happen again. If you are asked to remove a product, change the DB.

## Orders

Orders are inserted client-side from `page.tsx` straight into the `orders` table
(RLS-guarded), then `/api/webhook` sends the notification emails. `items` is a JSON
array of `{product_id, name, qty, unit_price, line_total}` where `unit_price` is
already tier-discounted, `subtotal` is the pre-discount wholesale total, and
`total` is the sum of `line_total`. QuickBooks invoices are created later via
`/api/qb/create-invoice`, which maps `products.qb_sku` to a QB ItemRef — so editing
an order must happen **before** `qb_invoice_id` is set.
