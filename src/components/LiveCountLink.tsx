"use client";

import Link from "next/link";
import { useSports } from "@azuro-org/sdk";

function LiveCountBadge() {
  const { data: sports, isLoading, isError } = useSports({
    isLive: true,
    filter: { maxGamesPerLeague: 1000 },
    query: {
      refetchInterval: 30_000,
    },
  });

  if (isLoading) {
    return (
      <div className="h-5 w-8 shrink-0 animate-pulse rounded-full bg-zinc-800" />
    );
  }

  if (isError) {
    return <span className="text-zinc-500">—</span>;
  }

  if (!sports?.length) {
    return (
      <span className="shrink-0 rounded-full bg-red-950/80 px-2 py-0.5 text-xs font-medium tabular-nums text-red-300">
        0
      </span>
    );
  }

  const n = sports.reduce(
    (sum, sport) =>
      sum +
      sport.countries.reduce(
        (cSum, country) =>
          cSum +
          country.leagues.reduce(
            (lSum, league) => lSum + league.games.length,
            0,
          ),
        0,
      ),
    0,
  );

  return (
    <span className="shrink-0 rounded-full bg-red-950/80 px-2 py-0.5 text-xs font-medium tabular-nums text-red-300">
      {n}
    </span>
  );
}

export function LiveCountLink() {
  return (
    <Link
      href="/live"
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
    >
      <span className="min-w-0 truncate font-medium">Live</span>
      <LiveCountBadge />
    </Link>
  );
}
