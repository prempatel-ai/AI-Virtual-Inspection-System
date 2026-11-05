import type { Metadata } from "next";
import localFont from "next/font/local";
import "../styles/tokens.css";
import "./globals.css";

const publicSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-public-sans",
  fallback: ["Public Sans", "system-ui", "-apple-system", "sans-serif"],
});

export const metadata: Metadata = {
  title: "PDS Virtual Inspection System",
  description: "Inspection priority ranking and traceable evidence for Fair Price Shops",
};

import { AuthProvider } from "../lib/auth";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} font-sans antialiased text-text bg-surface`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
