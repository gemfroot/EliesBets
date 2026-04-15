import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CasinoGate } from "./CasinoGate";

export const metadata: Metadata = {
  title: "Casino",
  description:
    "On-chain casino games (coming soon). Sports betting is available across the site.",
};

export default function CasinoLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <CasinoGate>{children}</CasinoGate>;
}
