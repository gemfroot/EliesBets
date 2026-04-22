"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders `children` only on routes where the sports betslip is relevant.
 * Casino games have their own wager UI inside the page, so the empty sports
 * slip was showing beside every coin-toss / dice / keno screen as noise.
 */
export function BetslipAsideGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/casino")) {
    return null;
  }
  return <>{children}</>;
}
