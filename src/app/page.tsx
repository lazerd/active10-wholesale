"use client";
import { useState } from "react";

const B = "#0072BC", BL = "#0088DD", BD = "#005A96", BBG = "#003A5C", BDP = "#00253D", GR = "#00B894";

const PRODUCTS = [
  { id: "plus-tube-3oz", name: "Active 10 PLUS", subtitle: "Full Spectrum Hemp Oil · 3oz Tube", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/products/CBDTubeNEW_370x373.png?v=1664841562", badge: "CBD", cat: "plus", color: "#e8f4ec" },
  { id: "plus-rollon", name: "Active 10 PLUS Roll-On", subtitle: "Full Spectrum Hemp Oil · 3oz", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/products/attempt2_600x600.jpg?v=1664841520", badge: "CBD", cat: "plus", color: "#e8f0f4" },
  { id: "plus-pump-8oz", name: "Active 10 PLUS Pump", subtitle: "Full Spectrum Hemp Oil · 8oz", retail: 69.95, img: "https://www.getactive10.com/cdn/shop/products/CBDPUMP1_600x601.jpg?v=1664841567", badge: "CBD", cat: "plus", color: "#e8ecf4" },
  { id: "original-tube-4oz", name: "Active 10 Original Tube", subtitle: "Pain Relief & Healing · 4oz", retail: 29.95, img: "https://www.getactive10.com/cdn/shop/products/newtube_600x601.jpg?v=1664841570", badge: null, cat: "original", color: "#f4f0e8" },
  { id: "original-pump-8oz", name: "Active 10 Original Pump", subtitle: "Pain Relief & Healing · 8oz", retail: 35.95, img: "https://www.getactive10.com/cdn/shop/products/2BF8A-1_600x600.jpg?v=1664841557", badge: null, cat: "original", color: "#f4ece8" },
  { id: "original-jar-2oz", name: "Active 10 Original Jar", subtitle: "Pain Relief & Healing · 2oz", retail: 21.95, img: "https://www.getactive10.com/cdn/shop/products/newjar_600x598.jpg?v=1664841564", badge: null, cat: "original", color: "#f0ece8" },
  { id: "original-rollon-3oz", name: "Active 10 Original Roll-On", subtitle: "Pain Relief & Healing · 3oz", retail: 24.95, img: "https://www.getactive10.com/cdn/shop/products/temp_2_600x798.png?v=1664841573", badge: null, cat: "original", color: "#f4f0ec" },
  { id: "sleep-drops", name: "Night Time Sleep Aid", subtitle: "Anti-Inflammation Water Drops", retail: 29.95, img: "https://www.getactive10.com/cdn/shop/files/IMG_0181_600x800.png?v=1698104945", badge: "NEW", cat: "wellness", color: "#e8e8f4" },
  { id: "cbd-capsules", name: "CBD Turmeric & Boswellia", subtitle: "Triple-Action Relief · 30 Caps", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/files/ChatGPTImageNov5_2025_03_38_05PM_600x901.png?v=1762385925", badge: "NEW", cat: "wellness", color: "#ece8f4" },
];

const CUSTOMERS = [
  { id: 1, name: "Dr. Dale Giessman", email: "dale@giessmandc.com", business: "Giessman Chiropractic", city: "Brentwood, CA", type: "Chiropractor", status: "active", joined: "2024-06-15", totalOrders: 24, totalSpent: 8450.00, lastOrder: "2026-03-18" },
  { id: 2, name: "Dr. Lisa Chen", email: "lisa@chenwellness.com", business: "Chen Wellness Center", city: "Walnut Creek, CA", type: "Chiropractor", status: "active", joined: "2024-09-22", totalOrders: 18, totalSpent: 6230.00, lastOrder: "2026-03-12" },
  { id: 3, name: "Dr. Mike Torres", email: "mike@torrespt.com", business: "Torres Physical Therapy", city: "Pleasanton, CA", type: "Physical Therapy", status: "active", joined: "2025-01-10", totalOrders: 12, totalSpent: 3890.50, lastOrder: "2026-02-28" },
  { id: 4, name: "Dr. Amy Patel", email: "amy@patelmassage.com", business: "Patel Therapeutic Massage", city: "Lafayette, CA", type: "Massage Therapy", status: "active", joined: "2025-03-05", totalOrders: 8, totalSpent: 2140.00, lastOrder: "2026-03-01" },
  { id: 5, name: "Dr. Robert Kim", email: "rkim@kimchiro.com", business: "Kim Family Chiropractic", city: "Orinda, CA", type: "Chiropractor", status: "active", joined: "2025-06-20", totalOrders: 6, totalSpent: 1560.75, lastOrder: "2026-02-15" },
  { id: 6, name: "Dr. Jennifer Wu", email: "jwu@eastbaypt.com", business: "East Bay PT & Sports", city: "Danville, CA", type: "Physical Therapy", status: "active", joined: "2025-08-12", totalOrders: 4, totalSpent: 980.00, lastOrder: "2026-01-20" },
  { id: 7, name: "Dr. Carlos Rivera", email: "carlos@riveramd.com", business: "Rivera Sports Medicine", city: "San Ramon, CA", type: "Medical Doctor", status: "paused", joined: "2025-04-18", totalOrders: 3, totalSpent: 645.00, lastOrder: "2025-11-10" },
];

const APPLICANTS = [
  { id: 101, name: "Dr. Sarah Mitchell", email: "sarah@mitchellchiro.com", business: "Mitchell Chiropractic", city: "Concord, CA", type: "Chiropractor", status: "pending", date: "2026-03-20" },
  { id: 102, name: "Dr. James Park", email: "jpark@ptpro.com", business: "PT Pro Wellness", city: "Dublin, CA", type: "Physical Therapy", status: "pending", date: "2026-03-22" },
  { id: 103, name: "Maria Gonzalez, LMT", email: "maria@healinghands.com", business: "Healing Hands Massage", city: "Martinez, CA", type: "Massage Therapy", status: "pending", date: "2026-03-23" },
];

const ORDERS = [
  { id: "ORD-1042", customer: "Dr. Dale Giessman", date: "2026-03-18", total: 487.50, status: "shipped", items: 12 },
  { id: "ORD-1039", customer: "Dr. Lisa Chen", date: "2026-03-12", total: 1240.00, status: "delivered", items: 28 },
  { id: "ORD-1035", customer: "Dr. Mike Torres", date: "2026-03-05", total: 199.75, status: "delivered", items: 6 },
  { id: "ORD-1031", customer: "Dr. Amy Patel", date: "2026-03-01", total: 340.00, status: "delivered", items: 10 },
  { id: "ORD-1028", customer: "Dr. Dale Giessman", date: "2026-02-22", total: 695.00, status: "delivered", items: 16 },
];

function getTier(s: number) {
  if (s >= 1000) return { name: "ELITE", disc: 0.20, color: "#E8C76A", next: null, at: null };
  if (s >= 300) return { name: "PRO+", disc: 0.15, color: BL, next: "ELITE", at: 1000 };
  if (s >= 150) return { name: "PRO", disc: 0.10, color: GR, next: "PRO+", at: 300 };
  return { name: "STARTER", disc: 0, color: "#8899AA", next: "PRO", at: 150 };
}
const ws = r => r * 0.5;
const fp = (r, d) => ws(r) * (1 - d);

const Img = ({ src, alt, color, style }) => {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ ...style, background: color || "#f0ece8", display: "flex", alignItems: "center", justifyContent: "center", color: B, fontWeight: 700, fontSize: 13, textAlign: "center", padding: 8 }}>{alt}</div>;
  return <img src={src} alt={alt} style={style} onError={() => setErr(true)} />;
};

export default function App() {
  const [cart, setCart] = useState({});
  const [view, setView] = useState("shop");
  const [filter, setFilter] = useState("all");
  const [userType, setUserType] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [authView, setAuthView] = useState("login");
  const [orderNote, setOrderNote] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [anim, setAnim] = useState(null);
  const [adminTab, setAdminTab] = useState("customers");
  const [applicants, setApplicants] = useState(APPLICANTS);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [appSubmitted, setAppSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [payMethod, setPayMethod] = useState("check");

  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const wsSub = items.reduce((s, [id, q]) => s + (PRODUCTS.find(p => p.id === id)?.retail || 0) * 0.5 * q, 0);
  const tier = getTier(wsSub);
  const total = items.reduce((s, [id, q]) => { const p = PRODUCTS.find(p => p.id === id); return s + (p ? fp(p.retail, tier.disc) * q : 0); }, 0);
  const count = items.reduce((s, [, q]) => s + q, 0);
  const save = items.reduce((s, [id, q]) => { const p = PRODUCTS.find(p => p.id === id); return s + (p ? (p.retail - fp(p.retail, tier.disc)) * q : 0); }, 0);

  const add = (id, d) => { setAnim(id); setTimeout(() => setAnim(null), 300); setCart(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) })); };
  const setQty = (id, q) => setCart(p => ({ ...p, [id]: Math.max(0, q) }));

  const login = () => {
    setLoginError("");
    const email = loginForm.email.trim().toLowerCase();
    const pass = loginForm.password.trim();
    if (email === "admin" && pass === "Active10Ollie") setUserType("admin");
    else if (loginForm.email && loginForm.password) setUserType("wholesale");
    else setLoginError("Please enter your credentials.");
  };
  const logout = () => { setUserType(null); setLoginForm({ email: "", password: "" }); setView("shop"); setCart({}); setSelectedCustomer(null); };
  const approve = id => setApplicants(p => p.map(a => a.id === id ? { ...a, status: "approved" } : a));
  const reject = id => setApplicants(p => p.map(a => a.id === id ? { ...a, status: "rejected" } : a));

  const filtered = filter === "all" ? PRODUCTS : PRODUCTS.filter(p => p.cat === filter);
  const bg = { minHeight: "100vh", background: `linear-gradient(165deg, ${BDP} 0%, ${BBG} 40%, ${BD} 100%)`, fontFamily: "'DM Sans', sans-serif", color: "white" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;800&display=swap" rel="stylesheet" />;
  const css = <style>{`@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}.ch:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.35)}.ch{transition:all .25s ease}.bh:hover{filter:brightness(1.12)}.bh:active{transform:scale(.97)}input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>;
  const inp = { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" };

  if (orderSuccess) return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}{css}
      <div style={{ textAlign: "center", padding: 40, maxWidth: 500, animation: "su .5s ease" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36 }}>✓</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 12 }}>Order Submitted!</h1>
        <p style={{ color: "rgba(255,255,255,.7)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Your wholesale order has been sent to Active Formulations. Confirmation email incoming.</p>
        <button onClick={() => { setOrderSuccess(false); setCart({}); setView("shop"); }} className="bh" style={{ padding: "14px 32px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Continue Shopping</button>
      </div>
    </div>
  );

  if (!userType) return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>{fonts}{css}
      <div style={{ maxWidth: 420, width: "100%", animation: "su .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "white" }}>A10</div>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.5px" }}>Active Formulations</span>
          </div>
          <p style={{ color: "rgba(255,255,255,.4)", fontSize: 13, letterSpacing: "2.5px", textTransform: "uppercase", marginTop: 6 }}>Wholesale Portal</p>
        </div>
        {authView === "apply" ? (
          appSubmitted ? (
            <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 40, textAlign: "center", animation: "su .5s ease" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>✓</div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 10 }}>Application Received!</h2>
              <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>Thank you for your interest in becoming an Active 10 wholesale partner.</p>
              <p style={{ color: "rgba(255,255,255,.45)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>Our team will review your application and get back to you within 24 hours. You'll receive an email with your login credentials once approved.</p>
              <div style={{ background: `${B}15`, border: `1px solid ${B}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
                <p style={{ color: BL, fontSize: 13, fontWeight: 500 }}>Questions? Email us at activeformulations@gmail.com</p>
              </div>
              <button onClick={() => { setAppSubmitted(false); setAuthView("login"); }} className="bh" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Back to Sign In</button>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Apply for Access</h2>
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 24 }}>We'll review within 24 hours.</p>
              {["Practice Name", "Full Name", "Email", "Phone"].map((l, i) => (<div key={i} style={{ marginBottom: 16 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{l}</label><input style={inp} /></div>))}
              <div style={{ marginBottom: 24 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Type</label><select style={{ ...inp, color: "rgba(255,255,255,.7)" }}><option>Chiropractor</option><option>Physical Therapy</option><option>Massage Therapy</option><option>Medical Doctor</option><option>Other</option></select></div>
              <button onClick={() => setAppSubmitted(true)} className="bh" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>Submit Application</button>
              <button onClick={() => setAuthView("login")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>Already have an account? Sign in</button>
            </div>
          )
        ) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Welcome Back</h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 28 }}>Sign in to your wholesale account</p>
            {loginError && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{loginError}</div>}
            <div style={{ marginBottom: 16 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Email</label><input value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} onKeyDown={e => e.key === "Enter" && login()} style={inp} placeholder="your@email.com" /></div>
            <div style={{ marginBottom: 24 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Password</label><div style={{ position: "relative" }}><input type={showPw ? "text" : "password"} value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && login()} style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" /><button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: showPw ? BL : "rgba(255,255,255,.35)", fontSize: 14 }}>{showPw ? "🙈" : "👁"}</button></div></div>
            <button onClick={login} className="bh" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>Sign In</button>
            <button onClick={() => setAuthView("apply")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>New? Apply for wholesale access</button>
          </div>
        )}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.2)", fontSize: 12, marginTop: 32 }}>Trusted by 200+ healthcare professionals</p>
      </div>
    </div>
  );

  // ADMIN
  if (userType === "admin") {
    const pending = applicants.filter(a => a.status === "pending");
    return (
      <div style={bg}>{fonts}{css}
        <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>Active 10 Wholesale</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1px", textTransform: "uppercase" }}>Admin</div></div>
            </div>
            <button onClick={logout} className="bh" style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" }}>Log Out</button>
          </div>
        </header>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 28 }}>
            {[{ l: "Pending", v: pending.length, c: "#FFA940" }, { l: "Active Customers", v: CUSTOMERS.filter(c => c.status === "active").length, c: GR }, { l: "Orders (Mar)", v: ORDERS.length, c: BL }, { l: "Revenue (Mar)", v: "$2,962", c: "#E8C76A" }].map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 20px", animation: `su .5s ease ${i * .07}s both` }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{s.l}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 4 }}>
            {["customers", "applicants", "orders"].map(t => (
              <button key={t} onClick={() => { setAdminTab(t); setSelectedCustomer(null); }} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", background: adminTab === t ? `${B}33` : "transparent", color: adminTab === t ? "white" : "rgba(255,255,255,.5)", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize", transition: "all .2s" }}>{t}</button>
            ))}
          </div>

          {/* CUSTOMERS TAB */}
          {adminTab === "customers" && !selectedCustomer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CUSTOMERS.map((c, i) => (
                <div key={c.id} onClick={() => setSelectedCustomer(c)} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all .2s", animation: `su .4s ease ${i * .05}s both` }} onMouseOver={e => e.currentTarget.style.borderColor = `${B}55`} onMouseOut={e => e.currentTarget.style.borderColor = `${B}22`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: BL }}>{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.business} · {c.city}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: BL }}>${c.totalSpent.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{c.totalOrders} orders · Last: {c.lastOrder}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CUSTOMER DETAIL */}
          {adminTab === "customers" && selectedCustomer && (
            <div style={{ animation: "su .4s ease" }}>
              <button onClick={() => setSelectedCustomer(null)} style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer", marginBottom: 20 }}>← Back to Customers</button>
              <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 18, padding: 28, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: BL }}>{selectedCustomer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{selectedCustomer.business}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 2 }}>{selectedCustomer.email} · {selectedCustomer.city}</div>
                  </div>
                  <div style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, background: selectedCustomer.status === "active" ? `${GR}22` : "rgba(255,160,64,.15)", color: selectedCustomer.status === "active" ? GR : "#FFA940", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{selectedCustomer.status}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
                  {[{ l: "Total Spent", v: `$${selectedCustomer.totalSpent.toLocaleString()}`, c: "#E8C76A" }, { l: "Total Orders", v: selectedCustomer.totalOrders, c: BL }, { l: "Member Since", v: selectedCustomer.joined, c: "rgba(255,255,255,.7)" }, { l: "Type", v: selectedCustomer.type, c: GR }].map((s, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Order History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ORDERS.filter(o => o.customer === selectedCustomer.name).map(o => (
                  <div key={o.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{o.id}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>{o.date} · {o.items} items</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, color: BL }}>${o.total.toFixed(2)}</div><div style={{ fontSize: 11, color: o.status === "shipped" ? "#FFA940" : GR, textTransform: "capitalize" }}>{o.status}</div></div>
                  </div>
                ))}
                {ORDERS.filter(o => o.customer === selectedCustomer.name).length === 0 && <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,.3)" }}>No orders found</div>}
              </div>
            </div>
          )}

          {/* APPLICANTS TAB */}
          {adminTab === "applicants" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pending.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No pending applications</div>}
              {pending.map(a => (
                <div key={a.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, animation: "su .4s ease" }}>
                  <div><div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{a.business} · {a.type} · {a.city}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>{a.email} · Applied {a.date}</div></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => approve(a.id)} className="bh" style={{ padding: "10px 20px", background: `linear-gradient(135deg,${GR},#00D2A0)`, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Approve</button>
                    <button onClick={() => reject(a.id)} className="bh" style={{ padding: "10px 20px", background: "rgba(255,80,80,.12)", border: "1px solid rgba(255,80,80,.25)", borderRadius: 8, color: "#FF6B6B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ORDERS TAB */}
          {adminTab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ORDERS.map((o, i) => (
                <div key={o.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", animation: `su .4s ease ${i * .05}s both` }}>
                  <div><div style={{ fontWeight: 700, fontSize: 15 }}>{o.id}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{o.customer} · {o.items} items</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 18, color: BL }}>${o.total.toFixed(2)}</div><div style={{ fontSize: 12, color: o.status === "shipped" ? "#FFA940" : GR, fontWeight: 500, textTransform: "capitalize" }}>{o.status} · {o.date}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // WHOLESALE SHOP
  return (
    <div style={bg}>{fonts}{css}
      <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>Active Formulations</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1.5px", textTransform: "uppercase" }}>Wholesale</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={logout} style={{ padding: "6px 12px", background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer" }}>Log Out</button>
            <button onClick={() => setView(view === "cart" ? "shop" : "cart")} className="bh" style={{ padding: "10px 20px", background: count > 0 ? `linear-gradient(135deg,${B},${BL})` : "rgba(255,255,255,.06)", border: count > 0 ? "none" : `1px solid ${B}33`, borderRadius: 10, color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>🛒 {count > 0 ? `${count} · $${total.toFixed(2)}` : "Cart"}</button>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 100px" }}>
        {view === "shop" && (
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "18px 24px", marginBottom: 24, animation: "su .5s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ padding: "6px 14px", borderRadius: 8, background: `${tier.color}22`, color: tier.color, fontWeight: 700, fontSize: 12, letterSpacing: "1px" }}>{tier.name}</div>
                <div><div style={{ fontSize: 14, fontWeight: 500 }}>{tier.disc > 0 ? `${(50 + tier.disc * 50).toFixed(0)}% off retail` : "50% off retail"}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Subtotal: ${wsSub.toFixed(2)}</div></div>
              </div>
              {tier.next && <div style={{ fontSize: 13, color: BL, fontWeight: 500 }}>${(tier.at - wsSub).toFixed(2)} more for {tier.next} →</div>}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 4 }}>
              {[{ n: "STARTER", a: 0, c: "#8899AA" }, { n: "PRO", a: 150, c: GR }, { n: "PRO+", a: 300, c: BL }, { n: "ELITE", a: 1000, c: "#E8C76A" }].map((t, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)", overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", borderRadius: 2, background: wsSub >= t.a ? t.c : "transparent", transition: "all .5s" }} /></div>
                  <span style={{ fontSize: 10, color: wsSub >= t.a ? t.c : "rgba(255,255,255,.25)", fontWeight: wsSub >= t.a ? 600 : 400 }}>{t.n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === "shop" && <>
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {[["all", "All"], ["plus", "PLUS (CBD)"], ["original", "Original"], ["wellness", "Wellness"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 18px", borderRadius: 10, border: filter === k ? `1px solid ${B}88` : `1px solid ${B}22`, background: filter === k ? `${B}22` : "transparent", color: filter === k ? BL : "rgba(255,255,255,.5)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .2s" }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18 }}>
            {filtered.map((p, i) => {
              const q = cart[p.id] || 0, f = fp(p.retail, tier.disc);
              return (
                <div key={p.id} className="ch" style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 18, overflow: "hidden", animation: `su .5s ease ${i * .05}s both` }}>
                  <div style={{ position: "relative", paddingTop: "80%", background: p.color }}>
                    <Img src={p.img} alt={p.name} color={p.color} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }} />
                    {p.badge && <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 9px", borderRadius: 6, background: p.badge === "CBD" ? `linear-gradient(135deg,${GR},#00D2A0)` : `linear-gradient(135deg,${B},${BL})`, color: "white", fontSize: 10, fontWeight: 700 }}>{p.badge}</div>}
                  </div>
                  <div style={{ padding: "14px 16px 16px" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, lineHeight: 1.3 }}>{p.name}</h3>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12 }}>{p.subtitle}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: BL }}>${f.toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", textDecoration: "line-through" }}>${p.retail}</span>
                      <span style={{ fontSize: 10, color: GR, fontWeight: 600 }}>{Math.round((1 - f / p.retail) * 100)}% off</span>
                    </div>
                    {q === 0 ? (
                      <button onClick={() => add(p.id, 1)} className="bh" style={{ width: "100%", padding: 10, background: `${B}15`, border: `1px solid ${B}44`, borderRadius: 10, color: BL, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ Add to Order</button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: 3 }}>
                        <button onClick={() => add(p.id, -1)} className="bh" style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "rgba(255,255,255,.08)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <input type="number" value={q} onChange={e => setQty(p.id, parseInt(e.target.value) || 0)} style={{ flex: 1, textAlign: "center", background: "none", border: "none", color: "white", fontSize: 16, fontWeight: 700, outline: "none", width: 36 }} />
                        <button onClick={() => add(p.id, 1)} className="bh" style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: `${B}33`, color: BL, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: anim === p.id ? "pu .3s ease" : "none" }}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>}
        {view === "cart" && (
          <div style={{ maxWidth: 700, margin: "0 auto", animation: "su .4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28 }}>Your Order</h2>
              <button onClick={() => setView("shop")} style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" }}>← Shopping</button>
            </div>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,.03)", borderRadius: 16, border: `1px solid ${B}22` }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🛒</p><p style={{ color: "rgba(255,255,255,.5)" }}>Cart is empty</p>
                <button onClick={() => setView("shop")} className="bh" style={{ marginTop: 20, padding: "12px 24px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 600, cursor: "pointer" }}>Browse Products</button>
              </div>
            ) : <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {items.map(([id, q]) => { const p = PRODUCTS.find(x => x.id === id); if (!p) return null; const f = fp(p.retail, tier.disc); return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: 14 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Img src={p.img} alt={p.name} color={p.color} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{p.subtitle}</div><div style={{ fontSize: 13, color: BL, fontWeight: 600, marginTop: 2 }}>${f.toFixed(2)} ea</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => add(id, -1)} className="bh" style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: "rgba(255,255,255,.08)", color: "white", fontSize: 15, cursor: "pointer" }}>−</button>
                      <span style={{ fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: "center" }}>{q}</span>
                      <button onClick={() => add(id, 1)} className="bh" style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: `${B}33`, color: BL, fontSize: 15, cursor: "pointer" }}>+</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, minWidth: 65, textAlign: "right" }}>${(f * q).toFixed(2)}</div>
                  </div>
                ); })}
              </div>
              <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Order Notes</label><textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Special instructions..." rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} /></div>
              
              {/* Payment Method */}
              <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".8px" }}>Payment Method</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label onClick={() => setPayMethod("check")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: payMethod === "check" ? `2px solid ${BL}` : `1px solid ${B}33`, background: payMethod === "check" ? `${B}15` : "transparent", cursor: "pointer", transition: "all .2s" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: payMethod === "check" ? `2px solid ${BL}` : "2px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {payMethod === "check" && <div style={{ width: 12, height: 12, borderRadius: "50%", background: BL }} />}
                    </div>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>Pay by Check</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 2 }}>No additional fees</div></div>
                  </label>
                  <label onClick={() => setPayMethod("card")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: payMethod === "card" ? `2px solid ${BL}` : `1px solid ${B}33`, background: payMethod === "card" ? `${B}15` : "transparent", cursor: "pointer", transition: "all .2s" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: payMethod === "card" ? `2px solid ${BL}` : "2px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {payMethod === "card" && <div style={{ width: 12, height: 12, borderRadius: "50%", background: BL }} />}
                    </div>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>Pay by Credit Card</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 2 }}>2.99% processing fee applies</div></div>
                  </label>
                </div>
              </div>

              {/* Order Summary */}
              <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "rgba(255,255,255,.5)" }}>Retail</span><span style={{ textDecoration: "line-through", color: "rgba(255,255,255,.3)" }}>${items.reduce((s, [id, q]) => s + (PRODUCTS.find(p => p.id === id)?.retail || 0) * q, 0).toFixed(2)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "rgba(255,255,255,.5)" }}>Wholesale (50%)</span><span>${wsSub.toFixed(2)}</span></div>
                {tier.disc > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: GR }}>{tier.name} ({(tier.disc * 100).toFixed(0)}% off)</span><span style={{ color: GR }}>-${(wsSub - total).toFixed(2)}</span></div>}
                {payMethod === "card" && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "#FFA940" }}>Credit Card Fee (2.99%)</span><span style={{ color: "#FFA940" }}>+${(total * 0.0299).toFixed(2)}</span></div>}
                <div style={{ borderTop: `1px solid ${B}22`, paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 16, fontWeight: 600 }}>Subtotal</span><span style={{ fontSize: 26, fontWeight: 800, color: BL }}>${payMethod === "card" ? (total + total * 0.0299).toFixed(2) : total.toFixed(2)}</span></div>
                <div style={{ background: `${GR}15`, border: `1px solid ${GR}33`, borderRadius: 10, padding: "9px 14px", marginTop: 12, fontSize: 13, color: GR, fontWeight: 500 }}>💰 Saving ${save.toFixed(2)} off retail</div>
              </div>

              {/* Shipping Notice */}
              <div style={{ background: "rgba(255,180,0,.08)", border: "1px solid rgba(255,180,0,.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📦</span>
                <div><p style={{ fontSize: 13, color: "#FFC940", fontWeight: 600, marginBottom: 2 }}>Shipping calculated separately</p><p style={{ fontSize: 12, color: "rgba(255,200,64,.6)", lineHeight: 1.5 }}>A shipping charge will be added to your invoice once calculated based on order weight and destination. Orders over $500 may qualify for free shipping.</p></div>
              </div>

              {wsSub < 50 ? <div style={{ textAlign: "center", padding: 14, background: "rgba(255,80,80,.08)", borderRadius: 12, border: "1px solid rgba(255,80,80,.15)", color: "#FF6B6B", fontSize: 14 }}>Minimum $50 — add ${(50 - wsSub).toFixed(2)} more</div>
              : <button onClick={() => setOrderSuccess(true)} className="bh" style={{ width: "100%", padding: 15, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>Submit Order · ${payMethod === "card" ? (total + total * 0.0299).toFixed(2) : total.toFixed(2)}</button>}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}
