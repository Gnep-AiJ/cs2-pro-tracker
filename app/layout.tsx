import type { Metadata } from "next";
import "./globals.css";
import "./compact.css";
import "./editorial.css";
import "./arena.css";
import LanguageProvider from "./components/LanguageProvider";
import ContactAccess from "./components/ContactAccess";

export const metadata: Metadata = {
  metadataBase: new URL("https://cs2pro.pages.dev"),
  title: "CS2 Pro Tracker — FACEIT & Events",
  description: "FACEIT pro matches first, major CS2 events second. FACEIT 职业选手对局、热门赛事与完整记分板。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "CS2 Pro Tracker",
    description: "FACEIT matches and major CS2 events. 职业选手对局与热门赛事。",
    type: "website",
    images: [{ url: "/og.png", width: 1732, height: 910, alt: "CS2 Pro Tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CS2 Pro Tracker",
    description: "FACEIT matches & major CS2 events. FACEIT 对局与热门赛事。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6630686107097564"
          crossOrigin="anonymous"
        />
      </head>
      <body><LanguageProvider>{children}<ContactAccess /></LanguageProvider></body>
    </html>
  );
}
