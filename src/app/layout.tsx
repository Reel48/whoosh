import type { Metadata } from "next";
import { EB_Garamond, Archivo } from "next/font/google";
import "./globals.css";

// Body / paragraph type per brand kit.
const ebGaramond = EB_Garamond({
  variable: "--font-body",
  subsets: ["latin"],
});

// Heading type. The brand kit specifies "Metal" for headers, which is not a
// free webfont — Archivo (heavy weights) is used as a close stand-in. To use
// the real Metal typeface, drop the font files into src/app and swap this for
// next/font/local, keeping the --font-heading variable name.
const archivo = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Whoosh — The only group chat you'll ever need",
  description:
    "Whoosh runs premium Discord communities. Subscribe to unlock members-only channels and perks.",
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
      className={`${ebGaramond.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
