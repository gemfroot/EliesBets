"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * When `NEXT_PUBLIC_CASINO_ENABLED` is not `"true"`, shows a blocking overlay so
 * sports-first launch does not invite real casino play. Build with the env set
 * to enable full casino UX.
 */
export function CasinoGate({ children }: { children: ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_CASINO_ENABLED === "true";
  if (enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[50vh]">
      <div className="pointer-events-none select-none opacity-[0.22]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/92 p-6 text-center backdrop-blur-sm">
        <p className="type-title text-zinc-100">Casino — coming soon</p>
        <p className="type-body max-w-md text-zinc-400">
          On-chain casino games are not available yet. Sports betting is live — explore
          markets from the home page.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-500"
        >
          Back to sports
        </Link>
      </div>
    </div>
  );
}
