"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", BBG = "#003A5C", BDP = "#00253D", GR = "#00B894";

type Dash = {
  affiliate: { name: string; slug: string; commission_rate: number; commission_rule: string; status: string };
  referralUrl: string;
  stats: { referredCount: number; payableEarned: number; pendingEarned: number; paidOut: number; owed: number };
  customers: { name: string; business: string; city: string; joined: string; orderCount: number; payable: number; pending: number }[];
};

const ruleLabel: Record<string, string> = { lifetime: "Lifetime", first_order: "First order", "12_months": "12 months" };

export default function AffiliateDashboard({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setErr("Please sign in again."); return; }
    const r = await fetch("/api/affiliate/dashboard", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (r.ok) setData(d); else setErr(d.error || "Could not load your dashboard.");
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.referralUrl) QRCode.toDataURL(data.referralUrl, { width: 320, margin: 1, color: { dark: "#00253D", light: "#ffffff" } }).then(setQr).catch(() => {}); }, [data?.referralUrl]);

  const bg: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(165deg, ${BDP} 0%, ${BBG} 40%, ${B} 140%)`, fontFamily: "'DM Sans', sans-serif", color: "white" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;800&display=swap" rel="stylesheet" />;
  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22 };
  const btnS: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer" };

  const copy = () => { if (!data) return; navigator.clipboard?.writeText(data.referralUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const downloadQr = () => { if (!qr || !data) return; const a = document.createElement("a"); a.href = qr; a.download = `active10-referral-${data.affiliate.slug}.png`; a.click(); };

  if (err) return (<div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}<div style={{ textAlign: "center" }}><p style={{ color: "#FF6B6B", marginBottom: 16 }}>{err}</p><button onClick={onLogout} style={btnS}>Log Out</button></div></div>);
  if (!data) return (<div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}<p style={{ opacity: .5 }}>Loading your affiliate dashboard…</p></div>);

  const a = data.affiliate;
  const stat = (label: string, value: string, color: string, sub?: string) => (
    <div style={{ ...card, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (<div style={bg}>{fonts}
    <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>Active Formulations</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1.5px", textTransform: "uppercase" }}>Affiliate Portal</div></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Hi, {a.name.split(" ")[0]}</span><button onClick={onLogout} style={btnS}>Log Out</button></div>
      </div>
    </header>

    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px 80px" }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, marginBottom: 6 }}>Your Referrals</h1>
      <p style={{ color: "rgba(255,255,255,.5)", marginBottom: 24 }}>Earning <strong style={{ color: GR }}>{Math.round(a.commission_rate * 100)}%</strong> · {ruleLabel[a.commission_rule] || a.commission_rule} commission{a.status !== "active" ? " · ⏸ paused" : ""}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 24 }}>
        {stat("Practices Referred", String(data.stats.referredCount), BL)}
        {stat("Commission Owed", `$${data.stats.owed.toFixed(2)}`, GR, "ready to be paid out")}
        {stat("Pending", `$${data.stats.pendingEarned.toFixed(2)}`, "#FFC940", "unlocks when orders confirm")}
        {stat("Paid to Date", `$${data.stats.paidOut.toFixed(2)}`, "rgba(255,255,255,.85)")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, marginBottom: 24, alignItems: "stretch" }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 12 }}>Your Referral Link</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input readOnly value={data.referralUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 220, padding: "12px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 14 }} />
            <button onClick={copy} style={{ padding: "12px 20px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "✓ Copied" : "Copy Link"}</button>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginTop: 14, lineHeight: 1.6 }}>Share this link (or the QR code) with practices you know. When they sign up and order, your commission shows up here automatically.</p>
        </div>
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {qr ? <img src={qr} alt="Referral QR code" style={{ width: 150, height: 150, borderRadius: 10, background: "white", padding: 6 }} /> : <div style={{ width: 150, height: 150 }} />}
          <button onClick={downloadQr} style={btnS}>⬇ Download QR</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 14 }}>Referred Practices</div>
        {data.customers.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,.45)", padding: "20px 0", textAlign: "center" }}>No referrals yet — share your link to get started! 🚀</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${B}22` }}>{["Practice", "Orders", "Earned", "Pending"].map((h, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>{data.customers.map((c, i) => (<tr key={i} style={{ borderBottom: `1px solid ${B}11` }}>
              <td style={{ padding: "12px 0" }}><div style={{ fontWeight: 600, fontSize: 14 }}>{c.business || c.name}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>{c.name}{c.city ? ` · ${c.city}` : ""} · joined {new Date(c.joined).toLocaleDateString()}</div></td>
              <td style={{ padding: "12px 0", textAlign: "right", color: "rgba(255,255,255,.7)" }}>{c.orderCount}</td>
              <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 700, color: GR }}>${c.payable.toFixed(2)}</td>
              <td style={{ padding: "12px 0", textAlign: "right", color: "#FFC940" }}>{c.pending > 0 ? `$${c.pending.toFixed(2)}` : "—"}</td>
            </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  </div>);
}
