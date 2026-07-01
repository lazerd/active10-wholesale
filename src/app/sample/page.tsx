"use client";
import { useState, useEffect } from "react";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" };
const btnP: React.CSSProperties = { background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, cursor: "pointer" };

export default function SamplePage() {
  const [form, setForm] = useState({ business: "", name: "", email: "", phone: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" });
  const [capToken, setCapToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // Render the Cloudflare Turnstile widget. No-op until the site key is configured.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || done) return;
    let widgetId: unknown;
    let cancelled = false;
    const render = () => {
      const ts = (window as any).turnstile;
      const el = document.getElementById("cf-turnstile-sample");
      if (cancelled || !ts || !el || el.hasChildNodes()) return;
      widgetId = ts.render("#cf-turnstile-sample", {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: (t: string) => setCapToken(t),
        "expired-callback": () => setCapToken(""),
        "error-callback": () => setCapToken(""),
      });
    };
    let poll: ReturnType<typeof setInterval> | undefined;
    if ((window as any).turnstile) render();
    else if (!document.getElementById("cf-turnstile-script")) {
      const s = document.createElement("script");
      s.id = "cf-turnstile-script";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    } else {
      poll = setInterval(() => { if ((window as any).turnstile) { if (poll) clearInterval(poll); render(); } }, 200);
    }
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      const ts = (window as any).turnstile;
      if (widgetId && ts) { try { ts.remove(widgetId); } catch {} }
      setCapToken("");
    };
  }, [done]);

  const submit = async () => {
    if (submitting) return;
    setErr("");
    if (!form.business || !form.name || !form.email || !form.address) { setErr("Please fill in your business, name, email, and shipping address."); return; }
    if (TURNSTILE_SITE_KEY && !capToken) { setErr("Please complete the verification challenge below."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, captchaToken: capToken }) });
      const d = await res.json();
      if (d.ok) setDone(true);
      else { setErr(d.error || "Could not submit. Please try again."); if (TURNSTILE_SITE_KEY) { try { (window as any).turnstile?.reset(); } catch {} setCapToken(""); } }
    } catch { setErr("Could not submit. Please check your connection and try again."); }
    setSubmitting(false);
  };

  const fields: { l: string; k: keyof typeof form }[] = [
    { l: "Business Name", k: "business" }, { l: "Your Name", k: "name" }, { l: "Email", k: "email" }, { l: "Phone", k: "phone" },
    { l: "Shipping Address", k: "address" }, { l: "City", k: "city" }, { l: "State", k: "state" }, { l: "Zip Code", k: "zip" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 50% -10%, #003A5C 0%, #00131f 55%, #000 100%)", color: "white", fontFamily: "system-ui, sans-serif", padding: "48px 20px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0, letterSpacing: "-.5px" }}>Active <span style={{ color: BL }}>10</span></h1>
          <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13, letterSpacing: "2.5px", textTransform: "uppercase", marginTop: 6 }}>Free Sample — No Sales Call</p>
        </div>

        {done ? (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 40, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>✓</div>
            <h2 style={{ fontSize: 24, marginBottom: 10 }}>Sample on the way!</h2>
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.6 }}>The Active 10 Team will get a free sample in the mail to you this week. Try it on yourself and a few others — no sales call, no catch.</p>
            <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13, marginTop: 18 }}>Questions? Email activeformulations@gmail.com</p>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
            <p style={{ color: "rgba(255,255,255,.7)", fontSize: 15, lineHeight: 1.6, marginBottom: 22 }}>
              Active 10 is a professional-grade topical recovery cream that practices and club pro shops stock and resell at the counter. Drop your shipping address and we&apos;ll mail you a <strong style={{ color: "white" }}>free sample</strong> — try it before you decide anything.
            </p>
            {err && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{err}</div>}
            {fields.map((f) => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{f.l}</label>
                <input value={form[f.k]} onChange={(e) => setForm((p) => ({ ...p, [f.k]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Business Type</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={{ ...inp, color: "white", background: "#0a2436" }}>
                {["Pro Shop", "Chiropractor", "Physical Therapy", "Massage Therapy", "Medical Doctor", "Other"].map((o) => <option key={o} value={o} style={{ color: "white", background: "#0a2436" }}>{o}</option>)}
              </select>
            </div>
            {TURNSTILE_SITE_KEY && <div id="cf-turnstile-sample" style={{ marginBottom: 16, minHeight: 65 }} />}
            <button onClick={submit} disabled={submitting} className="bh" style={{ ...btnP, width: "100%", padding: 15, fontSize: 16, opacity: submitting ? 0.6 : 1 }}>{submitting ? "Sending…" : "Send me a free sample"}</button>
            <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, textAlign: "center", marginTop: 14 }}>No sales call. No catch. Just a sample.</p>
          </div>
        )}
      </div>
    </div>
  );
}
