"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", BD = "#005A96", BBG = "#003A5C", BDP = "#00253D", GR = "#00B894";

// Types
type Product = { id: string; name: string; subtitle: string; retail: number; img: string; badge: string | null; cat: string; color: string; sort_order: number };
type Customer = { id: string; user_id: string; name: string; email: string; phone?: string; address?: string; business: string; city: string; type: string; status: string; total_orders: number; total_spent: number; last_order_at: string | null; created_at: string };
type Application = { id: string; name: string; email: string; business: string; city: string; phone: string; type: string; status: string; created_at: string; address?: string };
type Order = { id: string; order_number: string; customer_id: string; customer_name: string; customer_email: string; items: OrderItem[]; subtotal: number; tier_name: string; tier_discount: number; discount_amount: number; cc_fee: number; total: number; pay_method: string; notes: string; status: string; created_at: string };
type OrderItem = { product_id: string; name: string; qty: number; unit_price: number; line_total: number };

function getTier(s: number) {
  if (s >= 1000) return { name: "ELITE", disc: 0.20, color: "#E8C76A", next: null, at: null };
  if (s >= 300) return { name: "PRO+", disc: 0.15, color: BL, next: "ELITE", at: 1000 };
  if (s >= 150) return { name: "PRO", disc: 0.10, color: GR, next: "PRO+", at: 300 };
  return { name: "STARTER", disc: 0, color: "#8899AA", next: "PRO", at: 150 };
}
const ws = (r: number) => r * 0.5;
const fp = (r: number, d: number) => ws(r) * (1 - d);

const Img = ({ src, alt, color, style }: { src: string; alt: string; color: string; style?: React.CSSProperties }) => {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ ...style, background: color || "#f0ece8", display: "flex", alignItems: "center", justifyContent: "center", color: B, fontWeight: 700, fontSize: 13, textAlign: "center", padding: 8 }}>{alt}</div>;
  return <img src={src} alt={alt} style={style} onError={() => setErr(true)} />;
};

export default function App() {
  // Auth state
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // UI state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [view, setView] = useState("shop");
  const [filter, setFilter] = useState("all");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [authView, setAuthView] = useState("login");
  const [orderNote, setOrderNote] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [anim, setAnim] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState("customers");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [appSubmitted, setAppSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [payMethod, setPayMethod] = useState("check");
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [appForm, setAppForm] = useState({ name: "", email: "", phone: "", business: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUserData(s);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadUserData(s);
      else { setLoading(false); setIsAdmin(false); setCustomer(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load products (always)
  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("sort_order").then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, []);

  const loadUserData = async (s: any) => {
    setLoading(true);
    const email = s.user.email;

    // Check if admin
    const { data: adminData } = await supabase.from("admin_emails").select("email").eq("email", email).single();
    const admin = !!adminData;
    setIsAdmin(admin);

    // Get customer record
    const { data: custData } = await supabase.from("customers").select("*").eq("email", email).single();
    if (custData) setCustomer(custData as Customer);

    if (admin) {
      await loadAdminData();
    }
    setLoading(false);
  };

  const loadAdminData = async () => {
    const [custRes, appRes, ordRes] = await Promise.all([
      supabase.from("customers").select("*").order("total_spent", { ascending: false }),
      supabase.from("applications").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
    ]);
    if (custRes.data) setCustomers(custRes.data as Customer[]);
    if (appRes.data) setApplications(appRes.data as Application[]);
    if (ordRes.data) setOrders(ordRes.data as Order[]);
  };

  // Cart calculations
  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const wsSub = items.reduce((s, [id, q]) => s + (products.find(p => p.id === id)?.retail || 0) * 0.5 * q, 0);
  const tier = getTier(wsSub);
  const total = items.reduce((s, [id, q]) => { const p = products.find(p => p.id === id); return s + (p ? fp(p.retail, tier.disc) * q : 0); }, 0);
  const count = items.reduce((s, [, q]) => s + q, 0);
  const save = items.reduce((s, [id, q]) => { const p = products.find(p => p.id === id); return s + (p ? (p.retail - fp(p.retail, tier.disc)) * q : 0); }, 0);

  const add = (id: string, d: number) => { setAnim(id); setTimeout(() => setAnim(null), 300); setCart(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) })); };
  const setQty = (id: string, q: number) => setCart(p => ({ ...p, [id]: Math.max(0, q) }));

  // Auth functions
  const changePassword = async () => {
    if (newPw.length < 6) { setPwMsg("Password must be at least 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (!error) { setPwMsg("Password updated!"); setNewPw(""); setTimeout(() => { setShowChangePw(false); setPwMsg(""); }, 2000); }
    else setPwMsg("Error: " + error.message);
  };

  const forgotPassword = async () => {
    if (!resetEmail) { setResetMsg("Enter your email."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: "https://wholesale.getactive10.com" });
    if (!error) setResetMsg("Reset link sent! Check your inbox.");
    else setResetMsg("Error: " + error.message);
  };
  const login = async () => {
    setLoginError("");
    const email = loginForm.email.trim().toLowerCase();
    const pass = loginForm.password.trim();
    if (!email || !pass) { setLoginError("Please enter your credentials."); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setLoginError(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null); setIsAdmin(false); setCustomer(null);
    setLoginForm({ email: "", password: "" }); setView("shop"); setCart({}); setSelectedCustomer(null);
  };

// Submit application
  const submitApplication = async () => {
    const record = {
      name: appForm.name,
      email: appForm.email,
      phone: appForm.phone,
      business: appForm.business,
      city: appForm.city + ", " + appForm.state + " " + appForm.zip,
      type: appForm.type,
    };
    const { error } = await supabase.from("applications").insert(record);
    if (!error) {
      setAppSubmitted(true);
      fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "application", record }),
      }).catch(() => {});
    }
  };
  // Submit order
  const submitOrder = async () => {
    if (!customer || orderSubmitting) return;
    setOrderSubmitting(true);

    const orderItems: OrderItem[] = items.map(([id, q]) => {
      const p = products.find(p => p.id === id)!;
      const unitPrice = fp(p.retail, tier.disc);
      return { product_id: id, name: p.name, qty: q, unit_price: unitPrice, line_total: unitPrice * q };
    });

    const ccFee = payMethod === "card" ? total * 0.0299 : 0;
    const finalTotal = total + ccFee;

    const { data, error } = await supabase.from("orders").insert({
      order_number: "",
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      items: orderItems,
      subtotal: wsSub,
      tier_name: tier.name,
      tier_discount: tier.disc,
      discount_amount: wsSub - total,
      cc_fee: ccFee,
      total: finalTotal,
      pay_method: payMethod,
      notes: orderNote || null,
    }).select().single();

    setOrderSubmitting(false);
    if (!error && data) {
      setOrderSuccess(true);
      fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "order", record: data }),
      }).catch(() => {});
    } else {
      alert("Failed to submit order. Please try again.");
    }
  };
  // Admin actions
  const approveApp = async (id: string) => {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: id, action: "approve" }),
    });
    const data = await res.json();
    if (data.ok) {
      setApplications(p => p.map(a => a.id === id ? { ...a, status: "approved" } : a));
      loadAdminData();
    } else {
      alert("Error: " + (data.error || "Failed to approve"));
    }
  };
  const rejectApp = async (id: string) => {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: id, action: "reject" }),
    });
    const data = await res.json();
    if (data.ok) {
      setApplications(p => p.map(a => a.id === id ? { ...a, status: "rejected" } : a));
    } else {
      alert("Error: " + (data.error || "Failed to reject"));
    }
  };
  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  };

  // Export customers to CSV
  const exportCustomersCSV = () => {
    // Try to enrich customer data with application info (phone, address)
    const enriched = customers.map(c => {
      const app = applications.find(a => a.email === c.email);
      return {
        Name: c.name,
        Email: c.email,
        Phone: c.phone || app?.phone || "",
        Business: c.business,
        Address: c.address || app?.address || "",
        City: c.city,
        Type: c.type,
        Status: c.status,
        "Total Orders": c.total_orders,
        "Total Spent": `$${c.total_spent.toFixed(2)}`,
        "Last Order": c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "Never",
        "Member Since": new Date(c.created_at).toLocaleDateString(),
      };
    });

    if (enriched.length === 0) return;

    const headers = Object.keys(enriched[0]);
    const csvRows = [
      headers.join(","),
      ...enriched.map(row =>
        headers.map(h => {
          const val = String((row as any)[h]).replace(/"/g, '""');
          return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val}"` : val;
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `active10-customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter === "all" ? products : products.filter(p => p.cat === filter);
  const bg: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(165deg, ${BDP} 0%, ${BBG} 40%, ${BD} 100%)`, fontFamily: "'DM Sans', sans-serif", color: "white" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;800&display=swap" rel="stylesheet" />;
  const css = <style>{`@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}.ch:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.35)}.ch{transition:all .25s ease}.bh:hover{filter:brightness(1.12)}.bh:active{transform:scale(.97)}input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>;
  const inp: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" };

  // Loading screen
  if (loading) return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}{css}
      <div style={{ textAlign: "center", animation: "su .5s ease" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "white", margin: "0 auto 16px" }}>A10</div>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14 }}>Loading...</p>
      </div>
    </div>
  );

  // Order success
  if (orderSuccess) return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}{css}
      <div style={{ textAlign: "center", padding: 40, maxWidth: 500, animation: "su .5s ease" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36 }}>✓</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 12 }}>Order Submitted!</h1>
        <p style={{ color: "rgba(255,255,255,.7)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Your wholesale order has been sent to Active Formulations. You'll receive a confirmation email shortly.</p>
        <button onClick={() => { setOrderSuccess(false); setCart({}); setView("shop"); }} className="bh" style={{ padding: "14px 32px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Continue Shopping</button>
      </div>
    </div>
  );

  // LOGIN / APPLY SCREEN
  if (!session) return (
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
              {[
                { label: "Practice Name", key: "business" },
                { label: "Full Name", key: "name" },
                { label: "Email", key: "email" },
                { label: "Phone", key: "phone" },
                { label: "Street Address", key: "address" },
                { label: "City", key: "city" },
                { label: "State", key: "state" },
                { label: "Zip Code", key: "zip" },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{field.label}</label>
                  <input
                    value={(appForm as any)[field.key]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm(p => ({ ...p, [field.key]: e.target.value }))}
                    style={inp}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Type</label>
                <select value={appForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAppForm(p => ({ ...p, type: e.target.value }))} style={{ ...inp, color: "rgba(255,255,255,.7)" }}>
                  <option>Chiropractor</option><option>Physical Therapy</option><option>Massage Therapy</option><option>Medical Doctor</option><option>Other</option>
                </select>
              </div>
              <button onClick={submitApplication} className="bh" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>Submit Application</button>
              <button onClick={() => setAuthView("login")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>Already have an account? Sign in</button>
            </div>
          )
        ) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Welcome Back</h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 28 }}>Sign in to your wholesale account</p>
            {loginError && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{loginError}</div>}
            <div style={{ marginBottom: 16 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Email</label><input value={loginForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginForm(p => ({ ...p, email: e.target.value }))} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && login()} style={inp} placeholder="your@email.com" /></div>
            <div style={{ marginBottom: 24 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Password</label><div style={{ position: "relative" }}><input type={showPw ? "text" : "password"} value={loginForm.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && login()} style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" /><button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: showPw ? BL : "rgba(255,255,255,.35)", fontSize: 14 }}>{showPw ? "🙈" : "👁"}</button></div></div>
            <button onClick={login} className="bh" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>Sign In</button>
           {resetMsg && <div style={{ background: resetMsg.includes("Error") ? "rgba(255,80,80,.1)" : `${GR}15`, border: resetMsg.includes("Error") ? "1px solid rgba(255,80,80,.3)" : `1px solid ${GR}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: resetMsg.includes("Error") ? "#FF6B6B" : GR }}>{resetMsg}</div>}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={resetEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Enter your email" />
              <button onClick={forgotPassword} style={{ padding: "12px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Reset Password</button>
            </div>
            <button onClick={() => setAuthView("apply")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>New? Apply for wholesale access</button>
          </div>
        )}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.2)", fontSize: 12, marginTop: 32 }}>Trusted by 200+ healthcare professionals</p>
      </div>
    </div>
  );

  // ADMIN PANEL
  if (isAdmin) {
    const pending = applications.filter(a => a.status === "pending");
    const monthOrders = orders.filter(o => { const d = new Date(o.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const monthRevenue = monthOrders.reduce((s, o) => s + o.total, 0);

    return (
      <div style={bg}>{fonts}{css}
        <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>Active 10 Wholesale</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1px", textTransform: "uppercase" }}>Admin</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={loadAdminData} className="bh" style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" }}>↻ Refresh</button>
              <button onClick={logout} className="bh" style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" }}>Log Out</button>
            </div>
          </div>
        </header>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 28 }}>
            {[{ l: "Pending Apps", v: pending.length, c: "#FFA940" }, { l: "Active Customers", v: customers.filter(c => c.status === "active").length, c: GR }, { l: "Orders (Month)", v: monthOrders.length, c: BL }, { l: "Revenue (Month)", v: `$${monthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, c: "#E8C76A" }].map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 20px", animation: `su .5s ease ${i * .07}s both` }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{s.l}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 4 }}>
            {["customers", "applicants", "orders"].map(t => (
              <button key={t} onClick={() => { setAdminTab(t); setSelectedCustomer(null); setExpandedOrder(null); }} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", background: adminTab === t ? `${B}33` : "transparent", color: adminTab === t ? "white" : "rgba(255,255,255,.5)", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize", transition: "all .2s" }}>
                {t}{t === "applicants" && pending.length > 0 ? ` (${pending.length})` : ""}
              </button>
            ))}
          </div>

          {/* CUSTOMERS TAB */}
          {adminTab === "customers" && !selectedCustomer && (
            <div>
              {/* Export button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <button onClick={exportCustomersCSV} className="bh" style={{ padding: "8px 18px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>📥</span> Export Customers (CSV)
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {customers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No customers yet</div>}
                {customers.map((c, i) => (
                  <div key={c.id} onClick={() => setSelectedCustomer(c)} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all .2s", animation: `su .4s ease ${i * .05}s both` }} onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = `${B}55`)} onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = `${B}22`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: BL }}>{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.business} · {c.city}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: BL }}>${c.total_spent.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{c.total_orders} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOMER DETAIL (Enhanced with all contact info) */}
          {adminTab === "customers" && selectedCustomer && (() => {
            const app = applications.find(a => a.email === selectedCustomer.email);
            const custPhone = selectedCustomer.phone || app?.phone || "—";
            const custAddress = selectedCustomer.address || app?.address || "";
            const custOrders = orders.filter(o => o.customer_id === selectedCustomer.id);

            return (
              <div style={{ animation: "su .4s ease" }}>
                <button onClick={() => setSelectedCustomer(null)} style={{ padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer", marginBottom: 20 }}>← Back to Customers</button>

                {/* Profile Card */}
                <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 18, padding: 28, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: BL }}>{selectedCustomer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{selectedCustomer.business}</div>
                    </div>
                    <div style={{ padding: "6px 14px", borderRadius: 8, background: selectedCustomer.status === "active" ? `${GR}22` : "rgba(255,160,64,.15)", color: selectedCustomer.status === "active" ? GR : "#FFA940", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{selectedCustomer.status}</div>
                  </div>

                  {/* Contact Info Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 20 }}>
                    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>📧 Email</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: BL, wordBreak: "break-all" }}>{selectedCustomer.email}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>📱 Phone</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{custPhone}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>📍 Address</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{custAddress ? `${custAddress}, ${selectedCustomer.city}` : selectedCustomer.city}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>🏥 Type</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{selectedCustomer.type}</div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
                    {[
                      { l: "Total Spent", v: `$${selectedCustomer.total_spent.toLocaleString()}`, c: "#E8C76A" },
                      { l: "Total Orders", v: selectedCustomer.total_orders, c: BL },
                      { l: "Member Since", v: new Date(selectedCustomer.created_at).toLocaleDateString(), c: "rgba(255,255,255,.7)" },
                      { l: "Last Order", v: selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString() : "Never", c: GR },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order History with expandable detail */}
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Order History ({custOrders.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {custOrders.map(o => (
                    <div key={o.id}>
                      <div onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${expandedOrder === o.id ? `${B}55` : `${B}22`}`, borderRadius: expandedOrder === o.id ? "12px 12px 0 0" : 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all .2s" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{o.order_number}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>{new Date(o.created_at).toLocaleDateString()} · {o.items.reduce((s: number, i: OrderItem) => s + i.qty, 0)} items · {o.pay_method === "card" ? "💳 Card" : "📄 Check"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: BL }}>${o.total.toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: o.status === "shipped" ? "#FFA940" : o.status === "pending" ? "rgba(255,255,255,.5)" : GR, textTransform: "capitalize" }}>{o.status}</div>
                          </div>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", transition: "transform .2s", transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                        </div>
                      </div>
                      {/* Expanded order items */}
                      {expandedOrder === o.id && (
                        <div style={{ background: "rgba(255,255,255,.02)", border: `1px solid ${B}55`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px 20px", animation: "su .25s ease" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${B}22` }}>
                                <th style={{ textAlign: "left", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Product</th>
                                <th style={{ textAlign: "center", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Qty</th>
                                <th style={{ textAlign: "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Unit Price</th>
                                <th style={{ textAlign: "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.items.map((item: OrderItem, idx: number) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${B}11` }}>
                                  <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 500 }}>{item.name}</td>
                                  <td style={{ padding: "10px 0", fontSize: 14, textAlign: "center", color: "rgba(255,255,255,.7)" }}>{item.qty}</td>
                                  <td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", color: "rgba(255,255,255,.7)" }}>${item.unit_price.toFixed(2)}</td>
                                  <td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", fontWeight: 600, color: BL }}>${item.line_total.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Subtotal</span><span>${o.subtotal.toFixed(2)}</span></div>
                            {o.discount_amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: GR }}>{o.tier_name} Discount ({(o.tier_discount * 100).toFixed(0)}%)</span><span style={{ color: GR }}>-${o.discount_amount.toFixed(2)}</span></div>}
                            {o.cc_fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#FFA940" }}>CC Fee (2.99%)</span><span style={{ color: "#FFA940" }}>+${o.cc_fee.toFixed(2)}</span></div>}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginTop: 4 }}><span>Total</span><span style={{ color: BL }}>${o.total.toFixed(2)}</span></div>
                            {o.notes && <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,.03)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,.4)" }}>📝 {o.notes}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {custOrders.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,.3)" }}>No orders found</div>}
                </div>
              </div>
            );
          })()}

          {/* APPLICANTS TAB */}
          {adminTab === "applicants" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {applications.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No applications yet</div>}
              {applications.map(a => (
                <div key={a.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, animation: "su .4s ease" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{a.business} · {a.type} · {a.city}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>{a.email} · {a.phone} · Applied {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  {a.status === "pending" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => approveApp(a.id)} className="bh" style={{ padding: "10px 20px", background: `linear-gradient(135deg,${GR},#00D2A0)`, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Approve</button>
                      <button onClick={() => rejectApp(a.id)} className="bh" style={{ padding: "10px 20px", background: "rgba(255,80,80,.12)", border: "1px solid rgba(255,80,80,.25)", borderRadius: 8, color: "#FF6B6B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reject</button>
                    </div>
                  ) : (
                    <div style={{ padding: "6px 14px", borderRadius: 8, background: a.status === "approved" ? `${GR}22` : "rgba(255,80,80,.12)", color: a.status === "approved" ? GR : "#FF6B6B", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{a.status}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ORDERS TAB (with expandable line items) */}
          {adminTab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No orders yet</div>}
              {orders.map((o, i) => (
                <div key={o.id} style={{ animation: `su .4s ease ${i * .05}s both` }}>
                  <div onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${expandedOrder === o.id ? `${B}55` : `${B}22`}`, borderRadius: expandedOrder === o.id ? "14px 14px 0 0" : 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, cursor: "pointer", transition: "all .2s" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{o.order_number}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{o.customer_name} · {o.items.reduce((s: number, item: OrderItem) => s + item.qty, 0)} items · {o.pay_method === "card" ? "💳 Card" : "📄 Check"}</div>
                      {o.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>Note: {o.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <select
                        value={o.status}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateOrderStatus(o.id, e.target.value)}
                        style={{ padding: "6px 10px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "white", fontSize: 12, cursor: "pointer" }}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: BL }}>${o.total.toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>{new Date(o.created_at).toLocaleDateString()}</div>
                      </div>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", transition: "transform .2s", transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded order line items */}
                  {expandedOrder === o.id && (
                    <div style={{ background: "rgba(255,255,255,.02)", border: `1px solid ${B}55`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "18px 24px", animation: "su .25s ease" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${B}22` }}>
                            <th style={{ textAlign: "left", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Product</th>
                            <th style={{ textAlign: "center", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Qty</th>
                            <th style={{ textAlign: "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Unit Price</th>
                            <th style={{ textAlign: "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((item: OrderItem, idx: number) => (
                            <tr key={idx} style={{ borderBottom: `1px solid ${B}11` }}>
                              <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 500 }}>{item.name}</td>
                              <td style={{ padding: "10px 0", fontSize: 14, textAlign: "center", color: "rgba(255,255,255,.7)" }}>{item.qty}</td>
                              <td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", color: "rgba(255,255,255,.7)" }}>${item.unit_price.toFixed(2)}</td>
                              <td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", fontWeight: 600, color: BL }}>${item.line_total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Subtotal (Wholesale)</span><span>${o.subtotal.toFixed(2)}</span></div>
                        {o.discount_amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: GR }}>{o.tier_name} Discount ({(o.tier_discount * 100).toFixed(0)}%)</span><span style={{ color: GR }}>-${o.discount_amount.toFixed(2)}</span></div>}
                        {o.cc_fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#FFA940" }}>CC Fee (2.99%)</span><span style={{ color: "#FFA940" }}>+${o.cc_fee.toFixed(2)}</span></div>}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginTop: 4 }}><span>Total</span><span style={{ color: BL }}>${o.total.toFixed(2)}</span></div>
                        {o.notes && <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,.03)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,.4)" }}>📝 {o.notes}</div>}
                      </div>
                    </div>
                  )}
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
            {customer && <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Hi, {customer.name.split(" ")[0]}</span>}
            <button onClick={() => setShowChangePw(!showChangePw)} style={{ padding: "6px 12px", background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer" }}>Change Password</button>
            <button onClick={logout} style={{ padding: "6px 12px", background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer" }}>Log Out</button>
            <button onClick={() => setView(view === "cart" ? "shop" : "cart")} className="bh" style={{ padding: "10px 20px", background: count > 0 ? `linear-gradient(135deg,${B},${BL})` : "rgba(255,255,255,.06)", border: count > 0 ? "none" : `1px solid ${B}33`, borderRadius: 10, color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>🛒 {count > 0 ? `${count} · $${total.toFixed(2)}` : "Cart"}</button>
          </div>
        </div>
      </header>
      {showChangePw && (
        <div style={{ maxWidth: 400, margin: "20px auto", padding: "20px 24px", background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Change Password</h3>
          {pwMsg && <div style={{ background: pwMsg.includes("Error") ? "rgba(255,80,80,.1)" : `${GR}15`, border: pwMsg.includes("Error") ? "1px solid rgba(255,80,80,.3)" : `1px solid ${GR}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: pwMsg.includes("Error") ? "#FF6B6B" : GR }}>{pwMsg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <input type="password" value={newPw} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPw(e.target.value)} placeholder="New password (min 6 chars)" style={{ ...inp, flex: 1 }} />
            <button onClick={changePassword} className="bh" style={{ padding: "12px 20px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Update</button>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 100px" }}>
        {view === "shop" && (
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "18px 24px", marginBottom: 24, animation: "su .5s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ padding: "6px 14px", borderRadius: 8, background: `${tier.color}22`, color: tier.color, fontWeight: 700, fontSize: 12, letterSpacing: "1px" }}>{tier.name}</div>
                <div><div style={{ fontSize: 14, fontWeight: 500 }}>{tier.disc > 0 ? `${(50 + tier.disc * 50).toFixed(0)}% off retail` : "50% off retail"}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Subtotal: ${wsSub.toFixed(2)}</div></div>
              </div>
              {tier.next && <div style={{ fontSize: 13, color: BL, fontWeight: 500 }}>${((tier.at || 0) - wsSub).toFixed(2)} more for {tier.next} →</div>}
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
                        <input type="number" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(p.id, parseInt(e.target.value) || 0)} style={{ flex: 1, textAlign: "center", background: "none", border: "none", color: "white", fontSize: 16, fontWeight: 700, outline: "none", width: 36 }} />
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
                {items.map(([id, q]) => { const p = products.find(x => x.id === id); if (!p) return null; const f = fp(p.retail, tier.disc); return (
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
              <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Order Notes</label><textarea value={orderNote} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOrderNote(e.target.value)} placeholder="Special instructions..." rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} /></div>
              
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "rgba(255,255,255,.5)" }}>Retail</span><span style={{ textDecoration: "line-through", color: "rgba(255,255,255,.3)" }}>${items.reduce((s, [id, q]) => s + (products.find(p => p.id === id)?.retail || 0) * q, 0).toFixed(2)}</span></div>
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
              : <button onClick={submitOrder} disabled={orderSubmitting} className="bh" style={{ width: "100%", padding: 15, background: orderSubmitting ? "rgba(255,255,255,.1)" : `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 16, cursor: orderSubmitting ? "not-allowed" : "pointer" }}>{orderSubmitting ? "Submitting..." : `Submit Order · $${payMethod === "card" ? (total + total * 0.0299).toFixed(2) : total.toFixed(2)}`}</button>}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}
