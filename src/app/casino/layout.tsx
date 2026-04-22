import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CasinoGate } from "./CasinoGate";

const casinoEnabled = process.env.NEXT_PUBLIC_CASINO_ENABLED !== "false";

export const metadata: Metadata = {
  title: "Casino",
  description: casinoEnabled
    ? "On-chain casino games. Connect your wallet on a supported network."
    : "On-chain casino games (coming soon). Sports betting is available across the site.",
  robots: casinoEnabled
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default function CasinoLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <CasinoGate>{children}</CasinoGate>;
}
