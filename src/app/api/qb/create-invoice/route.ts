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

    // Get all products to look up SKUs
    const { data: products } = await supabase
      .from("products")
      .select("id, qb_sku");

    const skuMap: Record<string, string> = {};
    (products || []).forEach((p: { id: string; qb_sku: string | null }) => {
      if (p.qb_sku) skuMap[p.id] = p.qb_sku;
    });

    // Fetch ALL items from QB and match by SKU locally
    // (QB query API doesn't reliably support WHERE Sku = '')
    const itemCache: Record<string, { Id: string; Name: string }> = {};
    try {
      const allItems = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT * FROM Item MAXRESULTS 1000")}`
      );
      const qbItems = allItems?.QueryResponse?.Item || [];
      for (const qbItem of qbItems) {
        if (qbItem.Sku) {
          itemCache[qbItem.Sku] = { Id: qbItem.Id, Name: qbItem.Name };
        }
      }
      console.log("QB items loaded:", Object.keys(itemCache).length, "with SKUs");
      console.log("SKU map from DB:", JSON.stringify(skuMap));
      console.log("Item cache keys:", Object.keys(itemCache));
    } catch (e) {
      console.error("Failed to fetch QB items:", e);
    }

    // Get next invoice number — query by most recent creation date
    let nextDocNumber: string | undefined;
    try {
      const latestInv = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT DocNumber FROM Invoice ORDER BY MetaData.CreateTime DESC MAXRESULTS 1")}`
      );
      if (latestInv?.QueryResponse?.Invoice?.length > 0) {
        const lastDoc = latestInv.QueryResponse.Invoice[0].DocNumber;
        console.log("Latest QB invoice DocNumber:", lastDoc);
        const lastNum = parseInt(lastDoc, 10);
        if (!isNaN(lastNum)) {
          nextDocNumber = String(lastNum + 1);
          console.log("Next invoice number:", nextDocNumber);
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
        const qbItem = sku ? itemCache[sku] : null;

        console.log(`Line ${index + 1}: product=${item.product_id}, sku=${sku}, qbMatch=${qbItem ? qbItem.Name : "NONE"}`);

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

    console.log("Invoice payload:", JSON.stringify(invoiceData, null, 2));

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
