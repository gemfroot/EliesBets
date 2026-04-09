import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My bets",
  description:
    "View and filter your on-chain sports bets: pending, won, and lost, for your connected wallet.",
};

export default function BetsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
