import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Single typeface — Inter, full weight range. Body and headings both use Inter;
// headings just lean on the heavier weights (800/900) for modernist label feel.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoosh.lol";

// Mobile-first viewport. `viewportFit: "cover"` lets us use env(safe-area-inset-*)
// so fixed UI (bottom tab bar, future sticky CTAs) sits above the iPhone home
// indicator rather than under it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
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
      className={`${inter.variable} h-full antialiased`}
      style={{ ["--font-heading" as string]: "var(--font-body)" }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
