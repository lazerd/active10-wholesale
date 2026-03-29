import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getQBTokens, qbApi } from "../lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Match order item name to QB item by keywords
function findQBItem(orderItemName: string, qbItems: { Id: string; Name: string; Sku: string }[]): { Id: string; Name: string } | null {
  const name = orderItemName.toLowerCase();

  // Define mapping keywords: [order name contains, QB name contains]
  const rules: [string[], string[]][] = [
    [["plus", "pump", "8oz"], ["plus", "pump"]],
    [["plus", "pump", "8"], ["plus", "pump"]],
    [["plus", "roll"], ["plus", "roll"]],
    [["plus", "tube", "3oz"], ["plus", "3oz", "tube"]],
    [["plus", "tube", "3"], ["plus", "tube"]],
    [["sleep"], ["sleep"]],
    [["capsule"], ["cap"]],
    [["cbd", "turmeric"], ["cap"]],
    [["original", "pump", "8"], ["8oz", "pump", "regular"]],
    [["pump", "8oz"], ["8oz", "pump"]],
    [["original", "jar", "2"], ["2 oz", "jar"]],
    [["jar", "2oz"], ["2 oz", "jar"]],
    [["original", "tube", "4"], ["4oz", "tube"]],
    [["tube", "4oz"], ["4oz", "tube"]],
    [["original", "roll"], ["roll", "regular"]],
    [["roll-on", "3oz"], ["roll", "3oz"]],
  ];

  for (const [orderKeys, qbKeys] of rules) {
    if (orderKeys.every(k => name.includes(k))) {
      const match = qbItems.find(item => {
        const qbName = item.Name.toLowerCase();
        return qbKeys.every(k => qbName.includes(k));
      });
      if (match) return { Id: match.Id, Name: match.Name };
    }
  }

  // Fallback: find best overlap of words
  const words = name.split(/[\s\-()]+/).filter(w => w.length > 2);
  let bestMatch: { Id: string; Name: string } | null = null;
  let bestScore = 0;
  for (const item of qbItems) {
    const qbName = item.Name.toLowerCase();
    const score = words.filter(w => qbName.includes(w)).length;
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = { Id: item.Id, Name: item.Name };
    }
  }
  return bestMatch;
}

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

    // Fetch ALL items from QB
    let qbItems: { Id: string; Name: string; Sku: string }[] = [];
    try {
      const allItems = await qbApi(
        tokens.realm_id,
        tokens.access_token,
        `query?query=${encodeURIComponent("SELECT * FROM Item MAXRESULTS 1000")}`
      );
      qbItems = (allItems?.QueryResponse?.Item || []).map((i: any) => ({
        Id: i.Id,
        Name: i.Name,
        Sku: i.Sku || "",
      }));
      console.log("QB items loaded:", qbItems.length);
      console.log("QB item names:", qbItems.map(i => `${i.Name} (${i.Id})`));
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

    // Build invoice line items with name-based matching
    const orderItems = order.items || [];
    const lines = orderItems.map(
      (item: { product_id?: string; name?: string; qty: number; unit_price?: number }, index: number) => {
        const qbItem = item.name ? findQBItem(item.name, qbItems) : null;

        console.log(`Line ${index + 1}: "${item.name}" → ${qbItem ? `MATCHED "${qbItem.Name}" (${qbItem.Id})` : "NO MATCH"}`);

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
