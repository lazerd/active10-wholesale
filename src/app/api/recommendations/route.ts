import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// "Frequently bought together" — ranks products by how often they appear in the
// same orders as the items currently in the cart. Falls back to overall
// bestsellers when co-occurrence data is thin. Returns product_ids only.
export async function POST(req: NextRequest) {
  try {
    const { productIds } = await req.json();
    const inCart: string[] = Array.isArray(productIds) ? productIds : [];

    const { data: orders } = await supabaseAdmin.from("orders").select("items, status").neq("status", "cancelled");
    const all = orders || [];

    const coCount: Record<string, number> = {};
    const popularity: Record<string, number> = {};

    for (const o of all) {
      const ids: string[] = ((o.items as any[]) || []).map((i: any) => i.product_id).filter(Boolean);
      const uniq: string[] = Array.from(new Set(ids));
      for (const id of uniq) popularity[id] = (popularity[id] || 0) + 1;
      if (inCart.length && uniq.some((id) => inCart.includes(id))) {
        for (const id of uniq) if (!inCart.includes(id)) coCount[id] = (coCount[id] || 0) + 1;
      }
    }

    let ranked = Object.keys(coCount).sort((a, b) => coCount[b] - coCount[a]);
    // Fill with overall bestsellers (excluding cart items + already-ranked)
    if (ranked.length < 3) {
      const fallback = Object.keys(popularity)
        .filter((id) => !inCart.includes(id) && !ranked.includes(id))
        .sort((a, b) => popularity[b] - popularity[a]);
      ranked = [...ranked, ...fallback];
    }

    return NextResponse.json({ ok: true, productIds: ranked.slice(0, 4) });
  } catch (err: any) {
    console.error("recommendations error:", err);
    return NextResponse.json({ ok: false, productIds: [] });
  }
}
