import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Active 10 Wholesale Portal",
  description: "Wholesale ordering portal for Active Formulations healthcare partners",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
