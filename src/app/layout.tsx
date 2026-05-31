import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono, Sora, Quicksand } from "next/font/google";
import "./globals.css";

// Inter is the shared body/UI typeface across the whole site (marketing +
// every section). Headings outside a themed section lean on Inter's heavier
// weights (800/900) for the modernist label feel.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Section typefaces. Each signed-in section overrides --font-display (see
// globals.css [data-theme] scopes) to one of these. Colors stay shared; only
// the typographic personality changes per section.
//   Capital — Inter Tight (display) + JetBrains Mono (numbers), per the
//             Whoosh Capital design system. Numbers always render in the mono
//             face with tabular figures.
//   Fantasy — Sora (display) + JetBrains Mono (numbers), per the Whoosh Fantasy
//             design system. Mono carries scores/records with tabular figures.
//   Pool    — Quicksand: soft, rounded, friendly.
const interTight = Inter_Tight({ variable: "--font-capital", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-capital-num", subsets: ["latin"] });
const sora = Sora({ variable: "--font-fantasy", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const quicksand = Quicksand({ variable: "--font-pool", subsets: ["latin"] });

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
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} ${sora.variable} ${quicksand.variable} antialiased`}
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
