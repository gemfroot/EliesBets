"use client";

import { useBetsSummary, useChain } from "@azuro-org/sdk";
import { useConnection } from "wagmi";

/** Same idea as `fmtClaimHeadline`: small balances are not rounded away to 0.00. */
function formatTokenHeadline(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const maxDp = abs > 0 && abs < 0.01 ? 4 : 2;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDp,
  });
}

function fmtTokenAmountFromString(s: string | undefined): string {
  const n = Number.parseFloat(s ?? "0");
  if (!Number.isFinite(n)) return "—";
  return formatTokenHeadline(n);
}

/** To claim can be sub-cent; extra decimals help match wallet simulation. */
function fmtClaimHeadline(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0.00";
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export type BetsSummaryStripProps = {
  /**
   * Sum of expected payouts on every claimable settled slip currently loaded
   * (`sumClaimableExpectedPayout`). The headline uses `max(indexer toPayout, this)` so
   * it stays aligned with Claim all / wallet sim when the summary API lags.
   */
  claimableSlipTotal?: number;
  /** While `SettledBetsPrefetchProvider` walks settled pages for an accurate slip sum. */
  isPrefetchingSettledPages?: boolean;
  /** True when prefetch stopped at `MAX_SETTLED_PREFETCH_PAGES`. */
  settledPrefetchHitCap?: boolean;
};

export function BetsSummaryStrip({
  claimableSlipTotal,
  isPrefetchingSettledPages = false,
  settledPrefetchHitCap = false,
}: BetsSummaryStripProps = {}) {
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

  const indexerRaw = Number.parseFloat(data?.toPayout ?? "0");
  const indexer = Number.isFinite(indexerRaw) ? Math.max(0, indexerRaw) : 0;
  const slipRaw = claimableSlipTotal ?? 0;
  const slip = Number.isFinite(slipRaw) ? Math.max(0, slipRaw) : 0;
  const headline = Math.max(indexer, slip);
  const usesSlipBoost = slip > indexer + 1e-6;

  const toClaimTitle = usesSlipBoost
    ? `Higher of Azuro summary (${indexer.toFixed(4)} ${sym}) and sum of claimable payouts on loaded slips (${slip.toFixed(4)} ${sym}). Matches Claim all when all settled pages are loaded.`
    : `Unclaimed funds for this wallet (${sym}). Never shown negative; refreshes after you claim.`;

  return (
    <div
      className="mt-5 grid max-w-3xl grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:grid-cols-4"
      aria-live="polite"
    >
      <div title={toClaimTitle}>
        <p className="text-xs font-medium text-zinc-500">To claim</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data ? (
            "…"
          ) : (
            <>
              {`${fmtClaimHeadline(headline)} ${sym}`}
              {isPrefetchingSettledPages ? (
                <span className="ml-1 text-zinc-500" aria-hidden>
                  …
                </span>
              ) : null}
            </>
          )}
        </p>
        {settledPrefetchHitCap ? (
          <p className="mt-0.5 text-[10px] leading-snug text-amber-600/90">
            Very long bet history: not all settled pages were prefetched; “To claim” may be
            conservative until you open older pages.
          </p>
        ) : null}
        {usesSlipBoost ? (
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
            Summary API can lag; figure includes your claimable slips.
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">In play</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data
            ? "…"
            : `${fmtTokenAmountFromString(data?.inBets)} ${sym}`}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">Net P/L</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {isFetching && !data
            ? "…"
            : `${fmtTokenAmountFromString(data?.totalProfit)} ${sym}`}
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
