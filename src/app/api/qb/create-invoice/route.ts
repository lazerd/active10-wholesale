import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getQBTokens, qbApi } from "../lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Get product SKU mapping from Supabase
    const { data: products } = await supabase
      .from("products")
      .select("id, qb_sku");

    const skuMap: Record<string, string> = {};
    (products || []).forEach((p: { id: string; qb_sku: string | null }) => {
      if (p.qb_sku) skuMap[p.id] = p.qb_sku;
    });

    // Fetch ALL items from QB and index by EVERY possible field
    const qbItemLookup: Record<string, { Id: string; Name: string }> = {};
    try {
      const allItems = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT * FROM Item MAXRESULTS 1000")}`
      );
      const items = allItems?.QueryResponse?.Item || [];
      for (const item of items) {
        const ref = { Id: item.Id, Name: item.Name };
        // Index by every field so we can match no matter what
        if (item.Name) qbItemLookup[item.Name] = ref;
        if (item.Sku) qbItemLookup[item.Sku] = ref;
        if (item.Description) qbItemLookup[item.Description] = ref;
        if (item.FullyQualifiedName) qbItemLookup[item.FullyQualifiedName] = ref;
        // Also store by Id for direct lookup
        qbItemLookup[item.Id] = ref;
      }
      // Log ALL fields from first 3 items so we can see the actual structure
      console.log("SAMPLE QB ITEMS (first 3):", JSON.stringify(items.slice(0, 3).map((i: any) => ({
        Id: i.Id,
        Name: i.Name,
        Sku: i.Sku,
        Description: i.Description,
        FullyQualifiedName: i.FullyQualifiedName,
      })), null, 2));
      console.log("All lookup keys:", Object.keys(qbItemLookup));
      console.log("SKU map from DB:", JSON.stringify(skuMap));
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

    // Build invoice line items
    const orderItems = order.items || [];
    const lines = orderItems.map(
      (item: { product_id?: string; name?: string; qty: number; unit_price?: number }, index: number) => {
        const sku = item.product_id ? skuMap[item.product_id] : null;

        // Try matching by: SKU code, SKU with leading zeros stripped, product_id
        let qbItem = null;
        if (sku) {
          qbItem = qbItemLookup[sku]
            || qbItemLookup[sku.replace(/^0+/, '')]
            || qbItemLookup[`0${sku}`]
            || qbItemLookup[`00${sku}`];
        }

        console.log(`Line ${index + 1}: product="${item.product_id}", sku="${sku}", matched=${qbItem ? `YES → "${qbItem.Name}" (ID: ${qbItem.Id})` : "NO"}`);

        const up = Math.round((item.unit_price || 0) * 100) / 100;
        return {
          LineNum: index + 1,
          Amount: Math.round(item.qty * up * 100) / 100,
          DetailType: "SalesItemLineDetail",
          Description: item.name || "Product",
          SalesItemLineDetail: {
            Qty: item.qty,
            UnitPrice: up,
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
