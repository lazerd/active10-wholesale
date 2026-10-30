// One-off 10/29/26: put billing emails on 4 QB customers + their open invoices so the chaser can send them.
import { getQBTokens, qbApi } from "../src/app/api/qb/lib";
const FIX: Record<string, string> = { "16219": "mary.haas@mchsi.com", "16242": "drcharleshecht@drcharleshecht.com",
  "16272": "dr.scherba@gmail.com", "16275": "chiroeric@hotmail.com" };
const live = process.argv.includes("--live");
(async () => {
  const t = (await getQBTokens())!;
  for (const [doc, email] of Object.entries(FIX)) {
    const inv = (await qbApi(t.realm_id, t.access_token, `query?query=${encodeURIComponent(`SELECT * FROM Invoice WHERE DocNumber = '${doc}'`)}`)).QueryResponse.Invoice[0];
    const cust = (await qbApi(t.realm_id, t.access_token, `customer/${inv.CustomerRef.value}`)).Customer;
    console.log(`#${doc} ${inv.CustomerRef.name} (cust ${cust.Id}) bal ${inv.Balance} | cust email: ${cust.PrimaryEmailAddr?.Address || "-"} | inv email: ${inv.BillEmail?.Address || "-"} -> ${email}`);
    if (!live) continue;
    if (!cust.PrimaryEmailAddr?.Address)
      await qbApi(t.realm_id, t.access_token, "customer", "POST", { Id: cust.Id, SyncToken: cust.SyncToken, sparse: true, PrimaryEmailAddr: { Address: email } });
    const r = await qbApi(t.realm_id, t.access_token, "invoice", "POST", { Id: inv.Id, SyncToken: inv.SyncToken, sparse: true, BillEmail: { Address: email } });
    console.log("   updated, invoice email now", r.Invoice.BillEmail?.Address);
  }
})().catch((e) => { console.error(e); process.exit(1); });
