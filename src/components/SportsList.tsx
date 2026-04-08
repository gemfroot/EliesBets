"use client";

import Link from "next/link";
import { useSports } from "@azuro-org/sdk";
import type { SportData } from "@azuro-org/toolkit";

function countGames(sport: SportData): number {
  return sport.countries.reduce(
    (sum, country) =>
      sum +
      country.leagues.reduce((lSum, league) => lSum + league.games.length, 0),
    0,
  );
}

function SportsListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-2" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-5 w-8 shrink-0 animate-pulse rounded-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function SportsList() {
  const { data: sports, isLoading, isError } = useSports({
    isLive: false,
    filter: { maxGamesPerLeague: 10 },
  });

  if (isLoading) {
    return <SportsListSkeleton />;
  }

  if (isError) {
    return (
      <p className="px-4 text-xs text-red-400" role="alert">
        Could not load sports.
      </p>
    );
  }

  if (!sports?.length) {
    return (
      <p className="px-4 text-sm text-zinc-500">No sports available.</p>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Sports">
      {sports.map((sport) => {
        const n = countGames(sport);
        return (
          <Link
            key={sport.id}
            href={`/sports/${sport.slug}`}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            <span className="min-w-0 truncate">{sport.name}</span>
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-300">
              {n}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
