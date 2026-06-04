import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Brand typefaces — Clarika Pro, self-hosted:
//   Grotesque (--font-body)    — body / UI text everywhere.
//   Geometric (--font-capital) — the DISPLAY face: headings + section display.
// Numerals stay on Inter (--font-num, tabular-nums) so data columns line up —
// the Clarika DEMO files have non-tabular digits + no `tnum`; once the licensed
// Clarika files (with tabular figures) drop in, numerals can move to Grotesque.
//
// NOTE: these are Fontspring DEMO files (evaluation only, ~96 glyphs). They
// cover A–Z/a–z/0–9 + basic punctuation; missing glyphs (curly quotes, em-dash,
// accents) fall back to Inter. Replace src/app/fonts/* with the licensed
// Clarika Pro files (same filenames) before release — this is the only spot the
// web references the font files.
const grotesque = localFont({
  variable: "--font-body",
  display: "swap",
  src: [
    { path: "./fonts/ClarikaProGrotesque-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/ClarikaProGrotesque-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/ClarikaProGrotesque-Demibold.otf", weight: "600", style: "normal" },
    { path: "./fonts/ClarikaProGrotesque-Bold.otf", weight: "700", style: "normal" },
  ],
});

const geometric = localFont({
  variable: "--font-capital",
  display: "swap",
  src: [
    { path: "./fonts/ClarikaProGeometric-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/ClarikaProGeometric-Bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/ClarikaProGeometric-Heavy.otf", weight: "800", style: "normal" },
    { path: "./fonts/ClarikaProGeometric-Black.otf", weight: "900", style: "normal" },
  ],
});

// Numerals only — tabular digits for tickers/balances (see note above).
const interNum = Inter({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

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
      className={`${grotesque.variable} ${geometric.variable} ${interNum.variable} antialiased`}
      style={{ ["--font-heading" as string]: "var(--font-capital)" }}
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
