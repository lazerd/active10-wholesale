"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

// Customer-referral entry point. Remembers the referring customer's code and
// sends the visitor to the application form with the welcome offer attached.
export default function InviteLanding() {
  const params = useParams();
  const code = String((params?.code as string) || "").toLowerCase();

  useEffect(() => {
    if (code) {
      try {
        localStorage.setItem("a10_invite", code);
      } catch {}
    }
    window.location.replace(code ? `/?invite=${encodeURIComponent(code)}` : "/");
  }, [code]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(165deg,#00253D,#003A5C)", color: "white", fontFamily: "'DM Sans',sans-serif" }}>
      <p style={{ opacity: 0.6 }}>Loading your welcome offer…</p>
    </div>
  );
}
