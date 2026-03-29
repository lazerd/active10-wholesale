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

    // Look up QBO Item IDs by SKU, with Name fallback
    const itemCache: Record<string, { Id: string; Name: string }> = {};
    for (const [productId, sku] of Object.entries(skuMap)) {
      if (itemCache[sku]) continue;
      // Try by SKU first
      try {
        const q = await qbApi(
          tokens.realm_id,
          tokens.access_token,
          `query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Sku = '${sku}'`)}`
        );
        if (q?.QueryResponse?.Item?.length > 0) {
          const item = q.QueryResponse.Item[0];
          itemCache[sku] = { Id: item.Id, Name: item.Name };
          continue;
        }
      } catch (e) {
        console.error(`SKU lookup failed for ${sku}:`, e);
      }
      // Fallback: try by item Name containing the product name
      try {
        const orderItem = (order.items || []).find((i: { product_id?: string }) => i.product_id === productId);
        if (orderItem?.name) {
          const searchName = orderItem.name.replace(/'/g, "\\'");
          const q2 = await qbApi(
            tokens.realm_id,
            tokens.access_token,
            `query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Name LIKE '%${searchName}%'`)}`
          );
          if (q2?.QueryResponse?.Item?.length > 0) {
            const item = q2.QueryResponse.Item[0];
            itemCache[sku] = { Id: item.Id, Name: item.Name };
          }
        }
      } catch {
        // Name lookup also failed
      }
    }

    // Get next invoice number from QB
    let nextDocNumber: string | undefined;
    try {
      const latestInv = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT DocNumber FROM Invoice ORDER BY DocNumber DESC MAXRESULTS 1")}`
      );
      if (latestInv?.QueryResponse?.Invoice?.length > 0) {
        const lastNum = parseInt(latestInv.QueryResponse.Invoice[0].DocNumber, 10);
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
        const qbItem = sku ? itemCache[sku] : null;

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

    // Set invoice number if we found the next one
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
