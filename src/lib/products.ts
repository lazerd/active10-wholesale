export const PRODUCTS = [
  { id: "plus-tube-3oz", name: "Active 10 PLUS", subtitle: "Full Spectrum Hemp Oil · 3oz Tube", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/products/CBDTubeNEW_370x373.png?v=1664841562", badge: "CBD" as const, cat: "plus", color: "#e8f4ec" },
  { id: "plus-rollon", name: "Active 10 PLUS Roll-On", subtitle: "Full Spectrum Hemp Oil · 3oz", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/products/attempt2_600x600.jpg?v=1664841520", badge: "CBD" as const, cat: "plus", color: "#e8f0f4" },
  { id: "plus-pump-8oz", name: "Active 10 PLUS Pump", subtitle: "Full Spectrum Hemp Oil · 8oz", retail: 69.95, img: "https://www.getactive10.com/cdn/shop/products/CBDPUMP1_600x601.jpg?v=1664841567", badge: "CBD" as const, cat: "plus", color: "#e8ecf4" },
  { id: "original-tube-4oz", name: "Active 10 Original Tube", subtitle: "Pain Relief & Healing · 4oz", retail: 29.95, img: "https://www.getactive10.com/cdn/shop/products/newtube_600x601.jpg?v=1664841570", badge: null, cat: "original", color: "#f4f0e8" },
  { id: "original-pump-8oz", name: "Active 10 Original Pump", subtitle: "Pain Relief & Healing · 8oz", retail: 35.95, img: "https://www.getactive10.com/cdn/shop/products/2BF8A-1_600x600.jpg?v=1664841557", badge: null, cat: "original", color: "#f4ece8" },
  { id: "original-jar-2oz", name: "Active 10 Original Jar", subtitle: "Pain Relief & Healing · 2oz", retail: 21.95, img: "https://www.getactive10.com/cdn/shop/products/newjar_600x598.jpg?v=1664841564", badge: null, cat: "original", color: "#f0ece8" },
  { id: "original-rollon-3oz", name: "Active 10 Original Roll-On", subtitle: "Pain Relief & Healing · 3oz", retail: 24.95, img: "https://www.getactive10.com/cdn/shop/products/temp_2_600x798.png?v=1664841573", badge: null, cat: "original", color: "#f4f0ec" },
  { id: "sleep-drops", name: "Night Time Sleep Aid", subtitle: "Anti-Inflammation Water Drops", retail: 29.95, img: "https://www.getactive10.com/cdn/shop/files/IMG_0181_600x800.png?v=1698104945", badge: "NEW" as const, cat: "wellness", color: "#e8e8f4" },
  { id: "cbd-capsules", name: "CBD Turmeric & Boswellia", subtitle: "Triple-Action Relief · 30 Caps", retail: 39.95, img: "https://www.getactive10.com/cdn/shop/files/ChatGPTImageNov5_2025_03_38_05PM_600x901.png?v=1762385925", badge: "NEW" as const, cat: "wellness", color: "#ece8f4" },
];

export type Product = typeof PRODUCTS[number];

export interface Tier {
  name: string;
  disc: number;
  color: string;
  next: string | null;
  at: number | null;
}

export function getTier(subtotal: number): Tier {
  if (subtotal >= 1000) return { name: "ELITE", disc: 0.20, color: "#E8C76A", next: null, at: null };
  if (subtotal >= 300) return { name: "PRO+", disc: 0.15, color: "#0088DD", next: "ELITE", at: 1000 };
  if (subtotal >= 150) return { name: "PRO", disc: 0.10, color: "#00B894", next: "PRO+", at: 300 };
  return { name: "STARTER", disc: 0, color: "#8899AA", next: "PRO", at: 150 };
}

export function getWholesalePrice(retail: number): number {
  return retail * 0.5;
}

export function getFinalPrice(retail: number, tierDiscount: number): number {
  return getWholesalePrice(retail) * (1 - tierDiscount);
}

export const CC_FEE_RATE = 0.0299;
export const MIN_ORDER = 50;
