"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { usePendingBets } from "@/lib/casino/pendingBets";
import { explorerTxUrl } from "@/lib/chains";

const GAME_HREF: Record<string, string> = {
  coinToss: "/casino/coin-toss",
  dice: "/casino/dice",
  roulette: "/casino/roulette",
  keno: "/casino/keno",
  wheel: "/casino/wheel",
  plinko: "/casino/plinko",
};

const GAME_LABEL: Record<string, string> = {
  coinToss: "Coin toss",
  dice: "Dice",
  roulette: "Roulette",
  keno: "Keno",
  wheel: "Wheel",
  plinko: "Plinko",
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function PendingBetsIndicator() {
  const { pending, dismiss } = usePendingBets();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  // Re-render every second so elapsed time updates.
  useEffect(() => {
    if (pending.length === 0) return;
    const id = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [pending.length]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (pending.length === 0) return null;

  const unresolved = pending.filter((b) => b.status !== "resolved");
  const stalled = unresolved.some((b) => b.status === "stalled");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
          stalled
            ? "border-amber-700 bg-amber-950/70 text-amber-100 hover:border-amber-500"
            : "border-emerald-700/60 bg-emerald-950/60 text-emerald-200 hover:border-emerald-500"
        }`}
      >
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${stalled ? "bg-amber-400" : "bg-emerald-400"}`} />
        <span>
          {unresolved.length > 0 ? `${unresolved.length} pending` : `${pending.length} done`}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-80 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 shadow-lg"
        >
          <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400">
            Pending bets
          </div>
          <ul className="max-h-80 divide-y divide-zinc-900 overflow-y-auto">
            {pending.map((bet) => {
              const elapsed = formatElapsed(Date.now() - bet.placedAt);
              const txUrl = explorerTxUrl(bet.chainId, bet.txHash);
              const stake = (() => {
                try {
                  return formatUnits(BigInt(bet.stakeWei), bet.tokenDecimals);
                } catch {
                  return bet.stakeWei;
                }
              })();
              const net = (() => {
                if (!bet.netWei) return null;
                try {
                  const wei = BigInt(bet.netWei);
                  const abs = wei < 0n ? -wei : wei;
                  const sign = wei < 0n ? "−" : "+";
                  return `${sign}${formatUnits(abs, bet.tokenDecimals)} ${bet.tokenSymbol}`;
                } catch {
                  return null;
                }
              })();

              return (
                <li key={bet.id} className="px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={GAME_HREF[bet.game] ?? "/casino"}
                      className="font-medium text-zinc-100 hover:text-emerald-300"
                      onClick={() => setOpen(false)}
                    >
                      {GAME_LABEL[bet.game] ?? bet.game}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        bet.status === "resolved"
                          ? "bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-700/50"
                          : bet.status === "stalled"
                            ? "bg-amber-950/80 text-amber-200 ring-1 ring-amber-700/50"
                            : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {bet.status === "resolved"
                        ? bet.outcome ?? "Done"
                        : bet.status === "stalled"
                          ? "Slow"
                          : "Pending"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 font-mono text-xs text-zinc-400">
                    <span>
                      Bet {stake} {bet.tokenSymbol}
                    </span>
                    <span>{elapsed}</span>
                  </div>
                  {net ? (
                    <div className="mt-0.5 text-xs font-mono">
                      <span className={bet.outcome === "Won" ? "text-emerald-300" : "text-red-300"}>
                        {net}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    {txUrl ? (
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline"
                      >
                        tx
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => dismiss(bet.id)}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      dismiss
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
