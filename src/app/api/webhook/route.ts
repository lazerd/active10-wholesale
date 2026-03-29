import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const NOTIFY_EMAILS = [
  "darrinjco@gmail.com",
  "junemunroe@aol.com",
  "junemunroe@active10.net",
  "activeformulationorders@gmail.com",
];

async function sendEmail(to: string, subject: string, html: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Active 10 Wholesale <notifications@getactive10.com>",
      to,
      subject,
      html,
    }),
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
      const itemRows = items
        .map((item: any) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${SKU_MAP[item.product_id] || "—"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.unit_price).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.line_total).toFixed(2)}</td>
          </tr>
        `)
        .join("");

      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0072BC">New Wholesale Order: ${record.order_number}</h2>
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee;width:120px">Customer</td><td style="padding:10px;border-bottom:1px solid #eee">${record.customer_name}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:10px;border-bottom:1px solid #eee">${record.customer_email}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Tier</td><td style="padding:10px;border-bottom:1px solid #eee">${record.tier_name}</td></tr>
            <tr><td style="padding:10px;font-weight:bold;border-bottom:1px solid #eee">Payment</td><td style="padding:10px;border-bottom:1px solid #eee">${record.pay_method === "card" ? "Credit Card" : "Check"}</td></tr>
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
      return NextResponse.json({ ok: true, type: "order", results });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
