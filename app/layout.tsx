import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cs2pro.pages.dev"),
  title: "CS2 Pro Tracker — FACEIT 职业选手日报",
  description: "面向中文玩家的 CS2 职业选手 FACEIT 日报、官方排名与职业圈动态聚合。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "CS2 Pro Tracker",
    description: "查看职业选手近期 FACEIT 战绩、ELO 趋势、官方排名、逐场数据和可追溯动态。",
    type: "website",
    images: [{ url: "/og.png", width: 1732, height: 910, alt: "CS2 Pro Tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CS2 Pro Tracker",
    description: "FACEIT 职业选手日报、官方排名与动态聚合。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
