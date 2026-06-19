import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CryptoFlip — Provably Fair Crypto Coin Flip",
  description: "The most transparent crypto coin flip game. Play solo or with your squad. Provably fair, instant payouts.",
  keywords: ["crypto", "coin flip", "game", "provably fair", "web3", "gambling"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
