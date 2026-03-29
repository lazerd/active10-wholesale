import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { customerId, userId } = await req.json();
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customerId" }, { status: 400 });
    }

    // Delete customer record from DB
    const { error: custErr } = await supabase.from("customers").delete().eq("id", customerId);
    if (custErr) {
      return NextResponse.json({ ok: false, error: custErr.message }, { status: 500 });
    }

    // Delete auth user so the email can be reused
    if (userId) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
      if (authErr) {
        console.error("Failed to delete auth user:", authErr.message);
        return NextResponse.json({ ok: true, warning: "Customer deleted but auth user removal failed" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
