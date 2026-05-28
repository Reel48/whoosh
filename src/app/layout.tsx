import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Body / UI type.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// Display / heading type.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
