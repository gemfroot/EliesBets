"use client";

import { useBets, BetType, type Bet } from "@azuro-org/sdk";
import { useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";
import { BetCard } from "@/components/BetCard";
import { BetsSummaryStrip } from "@/components/BetsSummaryStrip";
import { ClaimAllBetsButton } from "@/components/ClaimAllBetsButton";
import { RetryCallout } from "@/components/RetryCallout";
import { BetsListSkeleton } from "@/components/Skeleton";

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
  const [tab, setTab] = useState<FilterTab>("all");

  const bettor = address ?? zeroAddress;

  const filter = useMemo(() => {
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

  const {
    data,
    isFetching,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useBets({
    filter,
    query: { enabled: queryEnabled },
  });

  const allBets = useMemo(
    () => data?.pages.flatMap((p) => p.bets) ?? [],
    [data],
  );

  const visibleBets = useMemo(() => filterBets(allBets, tab), [allBets, tab]);

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-display text-xl">My bets</h1>
          <p className="type-muted mt-1">
            Bets placed with your connected wallet on the app chain.
          </p>
        </div>
        {queryEnabled && !isError ? (
          <ClaimAllBetsButton
            bets={allBets}
            onDone={() => void refetch()}
          />
        ) : null}
      </div>

      {queryEnabled && !isError ? <BetsSummaryStrip /> : null}

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
