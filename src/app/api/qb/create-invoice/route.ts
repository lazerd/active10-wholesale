import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getQBTokens, qbApi } from "../lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Direct map: portal product ID → exact QB item Name
const PRODUCT_TO_QB_NAME: Record<string, string> = {
  "original-jar-2oz": "2 oz Jar",
  "original-pump-8oz": "8oz Pump Regular",
  "original-tube-4oz": "4oz Active 10 Tube Regular",
  "original-rollon-3oz": "3oz Roll-On Regular",
  "plus-tube-3oz": "Active 10 PLUS 3oz Tube with CBD",
  "cbd-capsules": "NEW CBD, Boswellia and Turmeric Caps - 30 per bottle",
  "plus-rollon": "3 oz Active 10 Plus Roll On",
  "plus-pump-8oz": "8 oz. Active 10 Plus CBD Cream Pump",
  "sleep-drops": "Sleep Drops",
};

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const tokens = await getQBTokens();
    if (!tokens) {
      return NextResponse.json({ error: "QuickBooks not connected" }, { status: 401 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.qb_invoice_id) {
      return NextResponse.json({
        success: true,
        qb_invoice_id: order.qb_invoice_id,
        message: "Invoice already exists in QuickBooks",
      });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", order.customer_id)
      .single();

    let qbCustomerId = customer?.qb_customer_id;

    if (!qbCustomerId) {
      const syncRes = await fetch(
        `https://wholesale.getactive10.com/api/qb/sync-customer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: order.customer_id }),
        }
      );
      const syncData = await syncRes.json();
      if (!syncData.success) {
        return NextResponse.json(
          { error: `Failed to sync customer: ${syncData.error}` },
          { status: 500 }
        );
      }
      qbCustomerId = syncData.qb_customer_id;
    }

    // Fetch ALL items from QB and index by Name
    const qbItemsByName: Record<string, { Id: string; Name: string }> = {};
    try {
      const allItems = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT * FROM Item MAXRESULTS 1000")}`
      );
      for (const item of allItems?.QueryResponse?.Item || []) {
        qbItemsByName[item.Name] = { Id: item.Id, Name: item.Name };
      }
      console.log("QB items indexed:", Object.keys(qbItemsByName).length);
    } catch (e) {
      console.error("Failed to fetch QB items:", e);
    }

    // Get next invoice number
    let nextDocNumber: string | undefined;
    try {
      const latestInv = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT DocNumber FROM Invoice ORDER BY MetaData.CreateTime DESC MAXRESULTS 1")}`
      );
      if (latestInv?.QueryResponse?.Invoice?.length > 0) {
        const lastDoc = latestInv.QueryResponse.Invoice[0].DocNumber;
        const lastNum = parseInt(lastDoc, 10);
        if (!isNaN(lastNum)) {
          nextDocNumber = String(lastNum + 1);
        }
      }
    } catch (e) {
      console.error("Failed to get latest invoice number:", e);
    }

    // Build invoice line items using direct product→QB name mapping
    const orderItems = order.items || [];
    const lines = orderItems.map(
      (item: { product_id?: string; name?: string; qty: number; unit_price?: number }, index: number) => {
        const qbName = item.product_id ? PRODUCT_TO_QB_NAME[item.product_id] : null;
        const qbItem = qbName ? qbItemsByName[qbName] : null;

        console.log(`Line ${index + 1}: product="${item.product_id}" → qbName="${qbName}" → ${qbItem ? `MATCHED ID ${qbItem.Id}` : "NO MATCH"}`);

        return {
          LineNum: index + 1,
          Amount: item.qty * (item.unit_price || 0),
          DetailType: "SalesItemLineDetail",
          Description: item.name || "Product",
          SalesItemLineDetail: {
            Qty: item.qty,
            UnitPrice: item.unit_price || 0,
            ...(qbItem ? { ItemRef: { value: qbItem.Id, name: qbItem.Name } } : {}),
          },
        };
      }
    );

    const invoiceData: Record<string, unknown> = {
      CustomerRef: { value: qbCustomerId },
      Line: lines,
      TxnDate: order.created_at
        ? new Date(order.created_at).toISOString().split("T")[0]
        : undefined,
      PrivateNote: `Wholesale portal order ${order.order_number || order.id}`,
    };

    if (nextDocNumber) {
      invoiceData.DocNumber = nextDocNumber;
    }

    const result = await qbApi(
      tokens.realm_id,
      tokens.access_token,
      "invoice",
      "POST",
      invoiceData
    );

    const qbInvoiceId = result.Invoice.Id;
    const qbDocNumber = result.Invoice.DocNumber || nextDocNumber || qbInvoiceId;

    await supabase
      .from("orders")
      .update({ qb_invoice_id: qbInvoiceId })
      .eq("id", orderId);

    return NextResponse.json({
      success: true,
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbDocNumber,
      message: `Invoice #${qbDocNumber} created in QuickBooks`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("QB create-invoice error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
