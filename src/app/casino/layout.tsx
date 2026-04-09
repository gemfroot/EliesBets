import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Casino",
  description:
    "On-chain casino games: flip a coin and more. Connect your wallet on Polygon or Gnosis.",
};

export default function CasinoLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
