import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const NOTIFY_EMAILS = [
  "darrinjco@gmail.com",
  "junemunroe@aol.com",
  "junemunroe@active10.net",
  "activeformulationorders@gmail.com",
];

const PRODUCT_WEIGHTS: Record<string, number> = {
  "original-jar-2oz":    4.2,
  "original-rollon-3oz": 5.1,
  "original-tube-4oz":   5.93,
  "original-pump-8oz":   11.5,
  "plus-tube-3oz":       4.7,
  "plus-rollon":         5.1,
  "plus-pump-8oz":       11.5,
  "cbd-capsules":        2.1,
  "sleep-drops":         3.4,
};

const BOX_WEIGHT_OZ = 5;
const BUBBLE_WRAP_OZ = 3;

function estimateShippingWeight(items: any[]): string {
  const productOz = items.reduce((sum: number, item: any) => {
    const w = PRODUCT_WEIGHTS[item.product_id] ?? 5.0;
    return sum + w * item.qty;
  }, 0);
  const totalOz = productOz + BOX_WEIGHT_OZ + BUBBLE_WRAP_OZ;
  const lbsWhole = Math.floor(totalOz / 16);
  const ozRemainder = (totalOz % 16).toFixed(1);
  return lbsWhole > 0 ? `${lbsWhole} lb ${ozRemainder} oz` : `${totalOz.toFixed(1)} oz`;
}

async function sendEmail(to: string, subject: string, html: string, from = "Active 10 Wholesale <notifications@getactive10.com>") {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, record } = body;

    if (type === "application") {
      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">New Wholesale Application</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee;width:120px">Name</td><td style="padding:10px;border-bottom:1px solid #eee">${record.name}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Business</td><td style="padding:10px;border-bottom:1px solid #eee">${record.business || "N/A"}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:10px;border-bottom:1px solid #eee">${record.email}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Phone</td><td style="padding:10px;border-bottom:1px solid #eee">${record.phone || "N/A"}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Type</td><td style="padding:10px;border-bottom:1px solid #eee">${record.type || "N/A"}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">City</td><td style="padding:10px;border-bottom:1px solid #eee">${record.city || "N/A"}</td></tr>
          </table>
          <p style="margin-top:24px">
            <a href="https://wholesale.getactive10.com" style="background:#0072BC;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Review in Admin Portal</a>
          </p>
        </div>
      `;
      const subject = "New Wholesale Application: " + record.name + " — " + (record.business || "");
      const results = [];
      for (const email of NOTIFY_EMAILS) {
        const res = await sendEmail(email, subject, html);
        results.push({ email, status: res.status });
      }
      return NextResponse.json({ ok: true, type: "application", results });
    }

    if (type === "order") {
      const items = record.items || [];

      let shippingAddress = "";
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: customer } = await supabase
          .from("customers")
          .select("address, city")
          .eq("id", record.customer_id)
          .single();
        if (customer) {
          const parts = [customer.address, customer.city].filter(Boolean);
          shippingAddress = parts.join(", ");
        }
      } catch {}

      const estWeight = estimateShippingWeight(items);

      const SKU_MAP: Record<string, string> = {
        "original-jar-2oz": "001",
        "original-pump-8oz": "004",
        "original-tube-4oz": "008",
        "original-rollon-3oz": "009",
        "plus-tube-3oz": "030",
        "cbd-capsules": "031",
        "plus-rollon": "032",
        "plus-pump-8oz": "033",
        "sleep-drops": "041",
      };

      const itemRows = items.map((item: any) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${SKU_MAP[item.product_id] || "—"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.unit_price).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.line_total).toFixed(2)}</td>
          </tr>`).join("");

      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">New Wholesale Order: ${record.order_number}</h2>
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee;width:120px">Customer</td><td style="padding:10px;border-bottom:1px solid #eee">${record.customer_name}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:10px;border-bottom:1px solid #eee">${record.customer_email}</td></tr>
            ${shippingAddress ? `<tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee;color:#0072BC">📦 Ship To</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:600;color:#0072BC">${shippingAddress}</td></tr>` : ""}
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Tier</td><td style="padding:10px;border-bottom:1px solid #eee">${record.tier_name}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Payment</td><td style="padding:10px;border-bottom:1px solid #eee">${record.pay_method === "card" ? "Credit Card" : "Check"}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">⚖️ Est. Weight</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:600">${estWeight}</td></tr>
            ${record.notes ? `<tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Notes</td><td style="padding:10px;border-bottom:1px solid #eee">${record.notes}</td></tr>` : ""}
          </table>
          <h3 style="color:#333">Items</h3>
          <table style="border-collapse:collapse;width:100%">
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">SKU</th>
              <th style="padding:8px;text-align:left">Product</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Unit</th>
              <th style="padding:8px;text-align:right">Total</th>
            </tr>
            ${itemRows}
          </table>
          <table style="border-collapse:collapse;width:100%;margin-top:16px">
            <tr><td style="padding:8px;font-weight:bold">Subtotal</td><td style="padding:8px;text-align:right">$${Number(record.subtotal).toFixed(2)}</td></tr>
            ${Number(record.discount_amount) > 0 ? `<tr><td style="padding:8px;color:#00B894">Tier Discount (${record.tier_name})</td><td style="padding:8px;text-align:right;color:#00B894">-$${Number(record.discount_amount).toFixed(2)}</td></tr>` : ""}
            ${Number(record.cc_fee) > 0 ? `<tr><td style="padding:8px;color:#FFA940">CC Fee (2.99%)</td><td style="padding:8px;text-align:right;color:#FFA940">+$${Number(record.cc_fee).toFixed(2)}</td></tr>` : ""}
            <tr style="font-size:18px"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;text-align:right;font-weight:bold;color:#0072BC">$${Number(record.total).toFixed(2)}</td></tr>
          </table>
          <p style="margin-top:24px">
            <a href="https://wholesale.getactive10.com" style="background:#0072BC;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">View in Admin Portal</a>
          </p>
        </div>
      `;

      const subject = "New Order " + record.order_number + ": $" + Number(record.total).toFixed(2) + " from " + record.customer_name;
      const results = [];
      for (const email of NOTIFY_EMAILS) {
        const res = await sendEmail(email, subject, html);
        results.push({ email, status: res.status });
      }

      if (record.customer_email) {
        const itemListRows = (record.items || []).map((item: any) => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e8f0fe;color:#1a1a2e">${item.name}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e8f0fe;text-align:center;font-weight:600;color:#0072BC">${item.qty}</td>
          </tr>`).join("");

        const confirmHtml = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
            <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px 32px 24px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;">
                  <span style="color:white;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span>
                </div>
                <h1 style="color:white;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Order Received!</h1>
                <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">We've got your wholesale order and we're on it.</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#1a1a2e;font-size:15px;margin:0 0 8px;">Hi <strong>${record.customer_name}</strong>,</p>
                <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 24px;">Thank you for your order! We've received it and will review it shortly. You'll receive a follow-up email with your official invoice and a secure payment link.</p>
                <div style="background:#f0f7ff;border:1px solid #cce0f5;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
                  <span style="color:#666;font-size:13px;">Order Reference: </span>
                  <span style="color:#0072BC;font-weight:700;font-size:14px;">${record.order_number || "Pending"}</span>
                </div>
                <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Items Ordered</h3>
                <table style="width:100%;border-collapse:collapse;background:#fafcff;border-radius:8px;overflow:hidden;border:1px solid #e8f0fe;">
                  <thead><tr style="background:#e8f0fe;">
                    <th style="padding:10px 8px;text-align:left;font-size:12px;color:#555;text-transform:uppercase;">Product</th>
                    <th style="padding:10px 8px;text-align:center;font-size:12px;color:#555;text-transform:uppercase;">Qty</th>
                  </tr></thead>
                  <tbody>${itemListRows}</tbody>
                </table>
                <div style="margin-top:28px;background:#fffbf0;border-left:4px solid #F4B942;border-radius:0 8px 8px 0;padding:16px 18px;">
                  <p style="margin:0;font-size:13px;color:#7a6000;font-weight:600;">What happens next?</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#7a6000;line-height:1.6;">Our team will send you an invoice with a secure payment link within 1 business day.</p>
                </div>
                <p style="color:#888;font-size:12px;margin-top:28px;line-height:1.6;">Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
              </div>
              <div style="background:#f4f7fc;padding:16px 32px;text-align:center;border-top:1px solid #e8f0fe;">
                <p style="margin:0;font-size:11px;color:#aaa;">Active Formulations Inc. · <a href="https://wholesale.getactive10.com" style="color:#0072BC;text-decoration:none;">wholesale.getactive10.com</a></p>
              </div>
            </div>
          </div>
        `;
        await sendEmail(record.customer_email, "We received your order — invoice coming soon!", confirmHtml, "Active 10 Wholesale <noreply@getactive10.com>");
      }

      return NextResponse.json({ ok: true, type: "order", results });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
