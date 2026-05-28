import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Single typeface — Inter, full weight range. Body and headings both use Inter;
// headings just lean on the heavier weights (800/900) for modernist label feel.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Whoosh — The only group chat you'll ever need",
  description:
    "Whoosh is a premium group chat for sports, entertainment, business, and everything in between. Subscribe to unlock members-only Discord channels.",
  icons: {
    icon: "/whoosh-bolt.svg",
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
