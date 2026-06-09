"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Data = {
  referralCode: string;
  referralUrl: string;
  balance: { available: number; pending: number };
  referrals: { email: string; name: string | null; status: string; reward: number }[];
};

const statusLabel: Record<string, { t: string; c: string }> = {
  invited: { t: "Invited", c: "#FFC940" },
  joined: { t: "Joined", c: BL },
  qualified: { t: "Earned $100", c: GR },
  expired: { t: "Expired", c: "rgba(255,255,255,.4)" },
};

export default function CustomerReferral({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return;
    const r = await fetch("/api/referral/my", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (r.ok) setData(d);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.referralUrl) QRCode.toDataURL(data.referralUrl, { width: 320, margin: 1, color: { dark: "#00253D", light: "#ffffff" } }).then(setQr).catch(() => {}); }, [data?.referralUrl]);

  const bg: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(165deg,#00253D 0%,#003A5C 45%,#0072BC 150%)", fontFamily: "'DM Sans',sans-serif", color: "white" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;800&display=swap" rel="stylesheet" />;
  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22 };
  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const btnP: React.CSSProperties = { padding: "12px 22px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer" };

  const copy = () => { if (!data) return; navigator.clipboard?.writeText(data.referralUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const downloadQr = () => { if (!qr || !data) return; const a = document.createElement("a"); a.href = qr; a.download = `active10-referral-${data.referralCode}.png`; a.click(); };
  const sendInvite = async () => {
    if (busy) return;
    if (!form.email) { setMsg({ t: "Enter your colleague's email.", ok: false }); return; }
    setBusy(true); setMsg(null);
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/referral/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    const d = await r.json();
    setBusy(false);
    if (d.ok) { setMsg({ t: `Invite sent to ${form.email}! 🎉`, ok: true }); setForm({ name: "", email: "" }); load(); }
    else setMsg({ t: d.error || "Couldn't send invite.", ok: false });
  };

  return (<div style={bg}>{fonts}
    <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: "#00253DEE", backdropFilter: "blur(20px)" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>Refer &amp; Earn</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1.5px", textTransform: "uppercase" }}>Grow the Network</div></div></div>
        <button onClick={onBack} style={btnS}>← Back to Shop</button>
      </div>
    </header>

    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, marginBottom: 8 }}>Refer a practice, earn $100</h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>Know another practice that would love Active 10? They get <strong style={{ color: "white" }}>20% off + free shipping + 25 free sample packets</strong> on their first order of $100+. You get <strong style={{ color: GR }}>$100 in account credit</strong> once that order is confirmed.</p>
      </div>

      {data && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 24 }}>
        <div style={{ ...card, textAlign: "center" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>Available Credit</div><div style={{ fontSize: 30, fontWeight: 800, color: GR }}>${data.balance.available.toFixed(2)}</div></div>
        <div style={{ ...card, textAlign: "center" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>Pending</div><div style={{ fontSize: 30, fontWeight: 800, color: "#FFC940" }}>${data.balance.pending.toFixed(2)}</div></div>
        <div style={{ ...card, textAlign: "center" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>Practices Referred</div><div style={{ fontSize: 30, fontWeight: 800, color: BL }}>{data.referrals.length}</div></div>
      </div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 12 }}>Share your link</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            <input readOnly value={data?.referralUrl || ""} onFocus={(e) => e.currentTarget.select()} style={{ ...inp, flex: 1, minWidth: 200 }} />
            <button onClick={copy} style={btnP}>{copied ? "✓ Copied" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 12 }}>Or email an invite</div>
          {msg && <div style={{ marginBottom: 10, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.ok ? "✓ " : "✕ "}{msg.t}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Colleague's name (optional)" style={inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="colleague@practice.com" style={{ ...inp, flex: 1 }} />
              <button onClick={sendInvite} disabled={busy} style={{ ...btnP, whiteSpace: "nowrap", opacity: busy ? 0.5 : 1 }}>{busy ? "Sending…" : "Send Invite"}</button>
            </div>
          </div>
        </div>
        <div style={{ ...card, flex: "1 1 200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {qr ? <img src={qr} alt="Referral QR" style={{ width: 180, height: 180, maxWidth: "100%", borderRadius: 10, background: "white", padding: 6 }} /> : <div style={{ width: 180, height: 180 }} />}
          <button onClick={downloadQr} style={btnS}>⬇ QR Code</button>
        </div>
      </div>

      {data && data.referrals.length > 0 && <div style={card}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 14 }}>Your Referrals</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{data.referrals.map((r, i) => { const sl = statusLabel[r.status] || { t: r.status, c: "white" }; return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,.02)", borderRadius: 10 }}>
            <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.name || r.email}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>{r.email}</div></div>
            <span style={{ fontSize: 13, fontWeight: 700, color: sl.c }}>{sl.t}</span>
          </div>); })}</div>
      </div>}
    </div>
  </div>);
}
