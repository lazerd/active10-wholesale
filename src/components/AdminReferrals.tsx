"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Row = { referrer: string; referredEmail: string; referredName: string | null; status: string; reward: number; createdAt: string };
type Summary = { invited: number; joined: number; qualified: number; rewardsGranted: number; creditRedeemed: number; creditOutstanding: number };
type Announce = { activeCustomers: number; announced: number; pending: number };

const statusColor: Record<string, string> = { invited: "#FFC940", joined: BL, qualified: GR, expired: "rgba(255,255,255,.4)" };

export default function AdminReferrals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [announce, setAnnounce] = useState<Announce | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/referral/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) { setRows(d.referrals); setSummary(d.summary); setAnnounce(d.announce || null); } else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const reconcile = async () => { setBusy(true); setMsg(null); const d = await call({ action: "reconcile" }); setBusy(false); if (d.ok) { setMsg({ t: `Reconciled — ${d.granted} new credit${d.granted === 1 ? "" : "s"} granted.`, ok: true }); load(); } else setMsg({ t: d.error || "Failed", ok: false }); };
  const doAnnounce = async () => { if (!announce || announce.pending === 0) return; if (!confirm(`Email the referral program to ${announce.pending} customer${announce.pending === 1 ? "" : "s"} who haven't been told yet?`)) return; setAnnouncing(true); setMsg(null); const d = await call({ action: "announce" }); setAnnouncing(false); if (d.ok) { setMsg({ t: `📣 Announcement sent to ${d.sent} customer${d.sent === 1 ? "" : "s"}.`, ok: true }); load(); } else setMsg({ t: d.error || "Failed to send", ok: false }); };

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };
  const stat = (l: string, v: string, c: string) => (<div style={{ ...card, padding: "16px 18px" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div></div>);

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Customer-to-customer referrals. $100 store credit is granted automatically when a referred practice's first order is confirmed.</div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={load} style={btnS}>↻ Refresh</button><button onClick={reconcile} disabled={busy} style={{ ...btnS, opacity: busy ? 0.5 : 1 }}>{busy ? "…" : "⟲ Reconcile credits"}</button></div>
    </div>

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {announce && <div style={{ background: `${GR}10`, border: `1px solid ${GR}33`, borderRadius: 14, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div><div style={{ fontSize: 14, fontWeight: 700 }}>📣 Tell your customers about the program</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Emails active customers a "refer a practice, earn $100" invite linking to their Refer &amp; Earn page. {announce.announced} announced · <strong style={{ color: announce.pending > 0 ? GR : "rgba(255,255,255,.5)" }}>{announce.pending} not yet invited</strong></div></div>
      <button onClick={doAnnounce} disabled={announcing || announce.pending === 0} style={{ padding: "11px 20px", background: announce.pending > 0 ? `linear-gradient(135deg,${GR},#00D2A0)` : "rgba(255,255,255,.06)", border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 13, cursor: announce.pending > 0 ? "pointer" : "default", opacity: announcing ? 0.5 : 1, whiteSpace: "nowrap" }}>{announcing ? "Sending…" : announce.pending > 0 ? `Email ${announce.pending} Customer${announce.pending === 1 ? "" : "s"}` : "✓ All Invited"}</button>
    </div>}

    {summary && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 20 }}>
      {stat("Invited", String(summary.invited), "#FFC940")}
      {stat("Joined", String(summary.joined), BL)}
      {stat("Qualified", String(summary.qualified), GR)}
      {stat("Credit Granted", `$${summary.rewardsGranted.toFixed(2)}`, "rgba(255,255,255,.85)")}
      {stat("Credit Redeemed", `$${summary.creditRedeemed.toFixed(2)}`, GR)}
      {stat("Outstanding", `$${summary.creditOutstanding.toFixed(2)}`, "#FFC940")}
    </div>}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No referrals yet. Customers can invite peers from their "Refer & Earn" page.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{rows.map((r, i) => (
        <div key={i} style={{ ...card, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.referredName || r.referredEmail}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{r.referredEmail} · referred by <strong style={{ color: "rgba(255,255,255,.7)" }}>{r.referrer}</strong></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>${r.reward} reward</span><span style={{ fontSize: 13, fontWeight: 700, color: statusColor[r.status] || "white", textTransform: "capitalize" }}>{r.status}</span></div>
        </div>
      ))}</div>}
  </div>);
}
