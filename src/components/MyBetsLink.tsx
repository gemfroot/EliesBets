"use client";

import Link from "next/link";
import { BetType, useBets } from "@azuro-org/sdk";
import { useEffect, useMemo, type ReactNode } from "react";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";

function usePendingBetsCount() {
  const { address, isConnected } = useConnection();
  const bettor = address ?? zeroAddress;
  const queryEnabled = Boolean(isConnected && address);

  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isFetching,
    isPending,
  } = useBets({
    filter: { bettor, type: BetType.Accepted },
    query: {
      enabled: queryEnabled,
      refetchInterval: 30_000,
    },
  });

  useEffect(() => {
    if (!queryEnabled) return;
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [queryEnabled, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const count = useMemo(
    () => data?.pages.flatMap((p) => p.bets).length ?? 0,
    [data],
  );

  return {
    count,
    showBadge: queryEnabled && count > 0,
    isLoading: queryEnabled && (isPending || (isFetching && !data)),
  };
}

function MyBetsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "h-[1.125rem] w-[1.125rem] text-zinc-400"}
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9h.01M12 16h.01M16 12h.01" />
    </svg>
  );
}

function PendingBetCountBadge({
  className = "shrink-0 rounded-full bg-amber-950/90 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-200",
}: {
  className?: string;
}) {
  const { showBadge, count, isLoading } = usePendingBetsCount();

  if (isLoading) {
    return (
      <div
        className="h-5 w-8 shrink-0 animate-pulse rounded-full bg-zinc-800"
        aria-hidden
      />
    );
  }

  if (!showBadge) {
    return null;
  }

  return (
    <span className={className}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

const VARIANT_CLASS = {
  sidebar:
    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50",
  header:
    "flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-zinc-50",
  mobile:
    "flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium text-zinc-400 transition hover:text-zinc-100",
} as const;

function MobileMyBetsLink({ className }: { className?: string }) {
  const { showBadge, count, isLoading } = usePendingBetsCount();

  return (
    <Link
      href="/bets"
      className={[VARIANT_CLASS.mobile, className].filter(Boolean).join(" ")}
    >
      <span className="relative inline-flex">
        <MyBetsIcon />
        {isLoading ? (
          <span
            className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full bg-zinc-800"
            aria-hidden
          />
        ) : showBadge ? (
          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-semibold leading-none text-zinc-950">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      Bets
    </Link>
  );
}

export function MyBetsLink({
  variant,
  className,
}: {
  variant: keyof typeof VARIANT_CLASS;
  className?: string;
}) {
  if (variant === "mobile") {
    return <MobileMyBetsLink className={className} />;
  }

  let inner: ReactNode;
  if (variant === "header") {
    inner = (
      <>
        <span>My bets</span>
        <PendingBetCountBadge />
      </>
    );
  } else {
    inner = (
      <>
        <span className="min-w-0 truncate font-medium">My bets</span>
        <PendingBetCountBadge />
      </>
    );
  }

  return (
    <Link
      href="/bets"
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
    >
      {inner}
    </Link>
  );
}
