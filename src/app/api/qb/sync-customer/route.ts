import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getQBTokens, qbApi } from "../lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await req.json();
    if (!customerId) {
      return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
    }

    const tokens = await getQBTokens();
    if (!tokens) {
      return NextResponse.json({ error: "QuickBooks not connected. Please connect first." }, { status: 401 });
    }

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (customer.qb_customer_id) {
      return NextResponse.json({
        success: true,
        qb_customer_id: customer.qb_customer_id,
        message: "Customer already synced to QuickBooks",
      });
    }

    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("email", customer.email)
      .single();

    const phone = customer.phone || app?.phone || "";
    const address = customer.address || app?.address || "";
    const displayName = customer.name || customer.email;

    // Search QB by email first
    try {
      const query = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent(
          `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${customer.email}'`
        )}`
      );
      if (query?.QueryResponse?.Customer?.length > 0) {
        const qbCust = query.QueryResponse.Customer[0];
        await supabase.from("customers").update({ qb_customer_id: qbCust.Id }).eq("id", customerId);
        return NextResponse.json({
          success: true,
          qb_customer_id: qbCust.Id,
          message: "Matched existing QuickBooks customer by email",
        });
      }
    } catch {
      // Query failed, continue
    }

    // Search QB by display name
    try {
      const nameQuery = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent(
          `SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`
        )}`
      );
      if (nameQuery?.QueryResponse?.Customer?.length > 0) {
        const qbCust = nameQuery.QueryResponse.Customer[0];
        await supabase.from("customers").update({ qb_customer_id: qbCust.Id }).eq("id", customerId);
        return NextResponse.json({
          success: true,
          qb_customer_id: qbCust.Id,
          message: "Matched existing QuickBooks customer by name",
        });
      }
    } catch {
      // Query failed, continue to create
    }

    // Try to create — if duplicate name error, append email to make unique
    const qbCustomerData: Record<string, unknown> = {
      DisplayName: displayName,
      PrimaryEmailAddr: { Address: customer.email },
      CompanyName: customer.business || "",
    };
    if (phone) qbCustomerData.PrimaryPhone = { FreeFormNumber: phone };
    if (address) qbCustomerData.BillAddr = { Line1: address, City: customer.city || "" };

    let result;
    try {
      result = await qbApi(tokens.realm_id, tokens.access_token, "customer", "POST", qbCustomerData);
    } catch (createErr: any) {
      // If duplicate name error, retry with email appended
      if (createErr.message && createErr.message.includes("6240")) {
        qbCustomerData.DisplayName = `${displayName} (${customer.email})`;
        result = await qbApi(tokens.realm_id, tokens.access_token, "customer", "POST", qbCustomerData);
      } else {
        throw createErr;
      }
    }

    const qbCustomerId = result.Customer.Id;
    await supabase.from("customers").update({ qb_customer_id: qbCustomerId }).eq("id", customerId);

    return NextResponse.json({
      success: true,
      qb_customer_id: qbCustomerId,
      message: "Customer created in QuickBooks",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("QB sync-customer error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
