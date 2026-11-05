import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "PDS Virtual Inspection System",
  description: "Inspection priority ranking and traceable evidence for Fair Price Shops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} font-sans antialiased text-text bg-surface`}>
        {children}
      </body>
    </html>
  );
}
