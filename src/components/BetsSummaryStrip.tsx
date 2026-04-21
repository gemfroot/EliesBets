"use client";

import { useBetsSummary, useChain } from "@azuro-org/sdk";
import { useConnection } from "wagmi";

function fmtTokenAmount(s: string | undefined): string {
  const n = Number.parseFloat(s ?? "0");
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BetsSummaryStrip() {
  const { address } = useConnection();
  const { betToken } = useChain();

  const { data, isFetching } = useBetsSummary({
    account: address ?? "",
    query: { enabled: Boolean(address) },
  });

  if (!address) {
    return null;
  }

  const sym = betToken.symbol;

  return (
    <div
      className="mt-5 grid max-w-3xl grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:grid-cols-4"
      aria-live="polite"
    >
      <div
        title={`Indexer total still owed to this wallet (${sym}). It can differ from the sum of “Payout” on each card until data syncs; it is not “per-bet payouts added up.”`}
      >
        <p className="text-xs font-medium text-zinc-500">To claim</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data ? "…" : `${fmtTokenAmount(data?.toPayout)} ${sym}`}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">In play</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data ? "…" : `${fmtTokenAmount(data?.inBets)} ${sym}`}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">Net P/L</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data ? "…" : `${fmtTokenAmount(data?.totalProfit)} ${sym}`}
        </p>
      </div>
      <div title="Win / loss / how many bet slips this wallet has on this chain (not a dollar total).">
        <p className="text-xs font-medium text-zinc-500">Record</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-200">
          {isFetching && !data ? (
            "…"
          ) : data ? (
            <>
              <span className="text-emerald-400">{data.wonBetsCount}W</span>
              <span className="text-zinc-600"> · </span>
              <span className="text-red-400/90">{data.lostBetsCount}L</span>
              <span className="text-zinc-600"> · </span>
              <span className="text-zinc-400">{data.betsCount} bets</span>
            </>
          ) : (
            "—"
          )}
        </p>
      </div>
    </div>
  );
}
