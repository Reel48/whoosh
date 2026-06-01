import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

// The whole site now runs on TWO typefaces:
//   Inter        (--font-body) — shared body / UI text everywhere. Numerals use
//                 Inter with tabular-nums (a deliberate earlier decision over a
//                 mono face), so they line up in tables without a third family.
//   Inter Tight  (--font-capital) — the brand DISPLAY face. It is the global
//                 --font-display; every section uses it. Per-section character
//                 comes from radius / density / accent color, NOT a separate
//                 typeface. (Sora, Quicksand, and the unused JetBrains Mono were
//                 dropped in the design-system unification.)
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const interTight = Inter_Tight({ variable: "--font-capital", subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoosh.business";

// Mobile-first viewport. `viewportFit: "cover"` lets us use env(safe-area-inset-*)
// so fixed UI (bottom tab bar, future sticky CTAs) sits above the iPhone home
// indicator rather than under it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f3f0",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Whoosh — The only group chat you'll ever need",
    template: "%s — Whoosh",
  },
  description:
    "Whoosh is a premium group chat for sports, entertainment, business, and everything in between. Subscribe to unlock members-only Discord channels.",
  icons: {
    icon: "/whoosh-bolt.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Whoosh",
    title: "Whoosh — The only group chat you'll ever need",
    description:
      "Sports, entertainment, business — all in one premium Discord. Plus Whoosh Bucks: earn yield, trade real stocks, wager on house events.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Whoosh — The only group chat you'll ever need",
    description:
      "Sports, entertainment, business — all in one premium Discord.",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} antialiased`}
      style={{ ["--font-heading" as string]: "var(--font-body)" }}
    >
      {/* min-h-dvh (dynamic viewport height), not the old html.h-full + body
          min-h-full percentage chain: iOS Chrome computed those 100% heights
          against a viewport taller than the visible area, so the document
          overflowed the screen and the fixed bottom tab bar landed mid-screen
          with empty space below it. dvh tracks the actual visible viewport on
          every browser (Safari was already correct), so it never overshoots
          and a short page still fills the screen. */}
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
