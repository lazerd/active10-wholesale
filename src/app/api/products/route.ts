import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The product catalog changes rarely, but the shared-tier Supabase compute was
// spiking to 1–3s on this query — and the storefront's whole shop grid waits on
// it. Serve it from Vercel's edge cache instead: revalidate every 60s so admin
// catalog edits still show up quickly, while doctors get a sub-100ms response.
export const revalidate = 60;

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) {
    return NextResponse.json({ products: [], error: error.message }, { status: 200 });
  }
  return NextResponse.json(
    { products: data || [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
