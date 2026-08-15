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

    // Index QB items by the identifier fields ONLY — exact, case-sensitive.
    //
    // Do NOT index by Item.Id or Item.Description, and do NOT fuzzy-match by
    // stripping/adding leading zeros. Our codes look like "004"/"008"/"011a",
    // and QB Ids are small integers, so a zero-stripped "004" -> "4" could bind
    // a line to whatever item happens to have Id 4. Case matters too: this file
    // has both "011a" (Active 10 PLUS Sample Packet) and "011S" (ACTIFLEX).
    // A wrong ItemRef silently decrements the wrong inventory, so the only
    // acceptable match is an exact one.
    type QBRef = { Id: string; Name: string; Type?: string; via: string };
    const qbItemLookup: Record<string, QBRef | "AMBIGUOUS"> = {};
    let qbItemsLoaded = false;
    try {
      const allItems = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT * FROM Item MAXRESULTS 1000")}`
      );
      const items = allItems?.QueryResponse?.Item || [];
      const index = (key: unknown, item: any, via: string) => {
        if (key === undefined || key === null || key === "") return;
        const k = String(key);
        const existing = qbItemLookup[k];
        if (existing && existing !== "AMBIGUOUS" && existing.Id !== item.Id) {
          // Two different items answer to the same key — refuse to guess.
          console.error(`QB item key "${k}" is ambiguous: Id ${existing.Id} vs Id ${item.Id}`);
          qbItemLookup[k] = "AMBIGUOUS";
          return;
        }
        if (!existing) {
          qbItemLookup[k] = { Id: item.Id, Name: item.Name, Type: item.Type, via };
        }
      };
      for (const item of items) {
        // In this company file the item Name carries the SKU code and the Sku
        // field carries the human label, so both are worth indexing.
        index(item.Name, item, "Name");
        index(item.Sku, item, "Sku");
        index(item.FullyQualifiedName, item, "FullyQualifiedName");
      }
      qbItemsLoaded = items.length > 0;
      console.log(`Loaded ${items.length} QB items; SKU map: ${JSON.stringify(skuMap)}`);
    } catch (e) {
      console.error("Failed to fetch QB items:", e);
    }

    if (!qbItemsLoaded) {
      return NextResponse.json(
        { error: "Could not load the QuickBooks item list — refusing to create an invoice that would miss inventory tracking." },
        { status: 502 }
      );
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

    // Build invoice line items. Every line must resolve to a real QB item —
    // a line with no ItemRef posts revenue without touching inventory, which is
    // worse than no invoice at all, so we refuse the whole thing instead.
    const orderItems = order.items || [];
    const unresolved: string[] = [];
    const lines = orderItems.map(
      (item: { product_id?: string; name?: string; qty: number; unit_price?: number }, index: number) => {
        const sku = item.product_id ? skuMap[item.product_id] : null;
        const found = sku ? qbItemLookup[sku] : undefined;
        const qbItem = found && found !== "AMBIGUOUS" ? found : null;

        const label = `${item.name || item.product_id || "line " + (index + 1)}`;
        if (!sku) {
          unresolved.push(`${label} — no qb_sku set on the product`);
        } else if (found === "AMBIGUOUS") {
          unresolved.push(`${label} — SKU "${sku}" matches more than one QuickBooks item`);
        } else if (!qbItem) {
          unresolved.push(`${label} — no QuickBooks item named "${sku}"`);
        }

        console.log(
          `Line ${index + 1}: product="${item.product_id}", sku="${sku}", ` +
          `matched=${qbItem ? `YES → Id ${qbItem.Id} "${qbItem.Name}" [${qbItem.Type}] via ${qbItem.via}` : "NO"}`
        );

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

    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          error:
            "Invoice not created — these lines do not map to a QuickBooks item, so they would post without decrementing inventory:\n\n• " +
            unresolved.join("\n• ") +
            "\n\nCreate the matching item in QuickBooks (or fix qb_sku on the product), then try again.",
          unresolved,
        },
        { status: 409 }
      );
    }

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
