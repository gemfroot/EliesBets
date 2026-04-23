"use client";

import { useBets, useBetsSummary, BetType, useChain, type Bet } from "@azuro-org/sdk";
import { useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";
import { base, gnosis, polygon } from "viem/chains";
import { BetCard } from "@/components/BetCard";
import { BetsSummaryStrip } from "@/components/BetsSummaryStrip";
import { ClaimAllBetsButton } from "@/components/ClaimAllBetsButton";
import {
  clearSettledPrefetchSessionFlag,
  useSettledBetsPrefetch,
} from "@/components/SettledBetsPrefetchProvider";
import { RetryCallout } from "@/components/RetryCallout";
import { BetsListSkeleton } from "@/components/Skeleton";
import { sumClaimableExpectedPayout } from "@/lib/azuroClaimEligibility";
import { chainName } from "@/lib/chains";
import type { SportsChainId } from "@/lib/sportsChainConstants";

type FilterTab = "all" | "pending" | "won" | "lost";

function filterBets(bets: Bet[], tab: FilterTab): Bet[] {
  if (tab === "all") return bets;
  if (tab === "pending") {
    return bets.filter(
      (b) =>
        !b.isWin &&
        !b.isLose &&
        !b.isCanceled &&
        !b.isCashedOut,
    );
  }
  if (tab === "won") {
    return bets.filter((b) => b.isWin && !b.isCanceled);
  }
  if (tab === "lost") {
    return bets.filter((b) => b.isLose && !b.isCanceled);
  }
  return bets;
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

const EMPTY_COPY: Record<
  FilterTab,
  { title: string; description: string }
> = {
  all: {
    title: "No bets yet",
    description:
      "When you place a bet with this wallet, it will show up here. Open a game, add selections to the betslip, and confirm to get started.",
  },
  pending: {
    title: "No pending bets",
    description:
      "You do not have any open bets waiting for results. Place a bet from a game, or check All to see your full history.",
  },
  won: {
    title: "No winning bets",
    description:
      "None of your settled bets are wins yet. Pending bets will move here when they cash as a win.",
  },
  lost: {
    title: "No lost bets",
    description:
      "None of your settled bets are losses. Pending bets will appear here if they settle as a loss.",
  },
};

export default function BetsPage() {
  const { address, isConnected } = useConnection();
  const { appChain, setAppChainId } = useChain();
  const [tab, setTab] = useState<FilterTab>("all");

  const bettor = address ?? zeroAddress;

  /** Drives the list under the tab (pending / settled / all). */
  const listFilter = useMemo(() => {
    const base = { bettor };
    if (tab === "pending") {
      return { ...base, type: BetType.Accepted as const };
    }
    if (tab === "won" || tab === "lost") {
      return { ...base, type: BetType.Settled as const };
    }
    return base;
  }, [bettor, tab]);

  const queryEnabled = Boolean(isConnected && address);

  // Side-query each supported sports chain so the user can see at a glance
  // where their bets live. The active `appChain` drives the main list below
  // (BetCard + useRedeemBet use the SDK context chain, so the render chain
  // must match what we claim against). These summaries are just counts we
  // surface as a header strip; clicking switches the whole page to that
  // chain's bets.
  const polygonSummary = useBetsSummary({
    account: address ?? "",
    chainId: polygon.id,
    query: { enabled: queryEnabled },
  });
  const baseSummary = useBetsSummary({
    account: address ?? "",
    chainId: base.id,
    query: { enabled: queryEnabled },
  });
  const gnosisSummary = useBetsSummary({
    account: address ?? "",
    chainId: gnosis.id,
    query: { enabled: queryEnabled },
  });
  const summaryByChain: Record<SportsChainId, typeof polygonSummary> = {
    [polygon.id]: polygonSummary,
    [base.id]: baseSummary,
    [gnosis.id]: gnosisSummary,
  };
  type ChainTotals = { total: number; pending: number };
  const totalsForChain = (
    sum: typeof polygonSummary,
  ): ChainTotals => {
    // useBetsSummary returns { data: { toPayout, inBets, winBets, ... } }
    // where inBets is the count of open/pending bets across the shape.
    // Fall back to zero when the query is disabled or still loading.
    const d = (sum.data ?? {}) as Record<string, unknown>;
    const n = (k: string) => {
      const v = d[k];
      return typeof v === "number" ? v : 0;
    };
    const pending = n("inBets");
    const winBets = n("winBets");
    const loseBets = n("loseBets");
    const canceled = n("canceledBets");
    const redeemed = n("redeemedBets");
    const cashedOut = n("cashedOutBets");
    return {
      pending,
      total:
        pending + winBets + loseBets + canceled + redeemed + cashedOut,
    };
  };
  const totalsByChain: Record<SportsChainId, ChainTotals> = {
    [polygon.id]: totalsForChain(polygonSummary),
    [base.id]: totalsForChain(baseSummary),
    [gnosis.id]: totalsForChain(gnosisSummary),
  };

  const { refetch: refetchBetsSummary } = useBetsSummary({
    account: address ?? "",
    query: { enabled: queryEnabled },
  });

  const {
    data,
    isFetching,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useBets({
    filter: listFilter,
    query: { enabled: queryEnabled },
  });

  const {
    settledBets: settledBetsForClaim,
    fetchNextPage: fetchSettledNextPage,
    hasNextPage: hasSettledNextPage,
    refetch: refetchSettled,
    isPrefetchingAllSettled,
    settledPrefetchHitCap,
  } = useSettledBetsPrefetch();

  const allBets = useMemo(
    () => data?.pages.flatMap((p) => p.bets) ?? [],
    [data?.pages],
  );

  const claimableSlipTotal = useMemo(
    () => sumClaimableExpectedPayout(settledBetsForClaim),
    [settledBetsForClaim],
  );

  const visibleBets = useMemo(() => filterBets(allBets, tab), [allBets, tab]);

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-display text-xl">My bets</h1>
          <p className="type-muted mt-1">
            Viewing bets on{" "}
            <span className="font-medium text-zinc-200">
              {chainName(appChain.id)}
            </span>
            . Switch chains below to see bets on other networks.
          </p>
        </div>
        {queryEnabled && !isError ? (
          <ClaimAllBetsButton
            bets={settledBetsForClaim}
            fetchNextPage={fetchSettledNextPage}
            hasNextPage={hasSettledNextPage}
            onDone={() => {
              if (address) {
                clearSettledPrefetchSessionFlag(address, appChain.id);
              }
              void refetch();
              void refetchSettled();
              void refetchBetsSummary();
            }}
          />
        ) : null}
      </div>

      {queryEnabled && !isError ? (
        <>
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Bet chain"
          >
            {(Object.keys(totalsByChain) as unknown as SportsChainId[]).map(
              (idRaw) => {
                const id = Number(idRaw) as SportsChainId;
                const totals = totalsByChain[id];
                const active = appChain.id === id;
                const loading = summaryByChain[id].isFetching && !summaryByChain[id].data;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      if (!active) setAppChainId(id);
                    }}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-100"
                        : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                    }`}
                  >
                    <span className="font-medium">{chainName(id)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                        active
                          ? "bg-emerald-900/60 text-emerald-100"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {loading
                        ? "…"
                        : totals.pending > 0
                          ? `${totals.total} · ${totals.pending} open`
                          : totals.total}
                    </span>
                  </button>
                );
              },
            )}
          </div>
          <BetsSummaryStrip
            claimableSlipTotal={claimableSlipTotal}
            isPrefetchingSettledPages={isPrefetchingAllSettled}
            settledPrefetchHitCap={settledPrefetchHitCap}
          />
        </>
      ) : null}

      <div
        className="mt-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
        role="tablist"
        aria-label="Bet status"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === id
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!isConnected || !address ? (
        <p className="mt-8 text-sm text-zinc-500">
          Connect your wallet to see your bets.
        </p>
      ) : isError ? (
        <RetryCallout
          className="mt-8"
          title="Could not load bets"
          description="We could not reach your bet history. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {isFetching && !data ? (
            <div className="mt-6" aria-busy aria-label="Loading bets">
              <BetsListSkeleton count={4} />
            </div>
          ) : visibleBets.length === 0 ? (
            <div className="mt-8 max-w-lg rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6">
              <p className="text-sm font-medium text-zinc-200">
                {EMPTY_COPY[tab].title}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {EMPTY_COPY[tab].description}
              </p>
            </div>
          ) : (
            <ul className="mt-6 flex max-w-3xl flex-col gap-4">
              {visibleBets.map((bet) => (
                <li key={bet.orderId}>
                  <BetCard bet={bet} />
                </li>
              ))}
            </ul>
          )}

          {hasNextPage ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
