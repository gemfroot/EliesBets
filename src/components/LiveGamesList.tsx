"use client";

import type { GameData } from "@azuro-org/toolkit";
import { useEffect, useMemo, useState } from "react";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { LiveGameCard } from "@/components/LiveGameCard";
import { RetryCallout } from "@/components/RetryCallout";
import { SportNavIcon } from "@/lib/sportNavIcon";

type SportFilterTab = { slug: string; name: string; count: number };

function buildSportFilterTabs(games: GameData[]): SportFilterTab[] {
  const bySlug = new Map<string, SportFilterTab>();
  for (const g of games) {
    const slug = g.sport.slug;
    const existing = bySlug.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      bySlug.set(slug, { slug, name: g.sport.name, count: 1 });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function AllSportsIcon({
  className = "h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-300",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

type LeagueGroup = {
  leagueKey: string;
  leagueName: string;
  sportSlug: string;
  sportName: string;
  countryName: string;
  games: GameData[];
};

function groupGamesByLeague(games: GameData[]): LeagueGroup[] {
  const map = new Map<string, LeagueGroup>();
  for (const game of games) {
    const leagueKey = game.league.slug;
    const leagueName = game.league.name;
    let group = map.get(leagueKey);
    if (!group) {
      group = {
        leagueKey,
        leagueName,
        sportSlug: game.sport.slug,
        sportName: game.sport.name,
        countryName: game.country.name,
        games: [],
      };
      map.set(leagueKey, group);
    }
    group.games.push(game);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  for (const g of groups) {
    g.games.sort((a, b) => +a.startsAt - +b.startsAt);
  }
  return groups;
}

export function LiveGamesList({
  games,
  loadError,
}: {
  games: GameData[];
  loadError: string | null;
}) {
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const sportTabs = useMemo(() => buildSportFilterTabs(games), [games]);
  const filteredGames = useMemo(
    () =>
      selectedSport === "all"
        ? games
        : games.filter((g) => g.sport.slug === selectedSport),
    [games, selectedSport],
  );
  const byLeague = useMemo(
    () => groupGamesByLeague(filteredGames),
    [filteredGames],
  );

  useEffect(() => {
    if (
      selectedSport !== "all" &&
      !games.some((g) => g.sport.slug === selectedSport)
    ) {
      setSelectedSport("all");
    }
  }, [games, selectedSport]);

  if (loadError) {
    return (
      <RetryCallout
        className="mt-6"
        title="Could not load live games"
        description={loadError}
      />
    );
  }

  if (!games.length) {
    return (
      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6 text-center">
        <p className="text-sm font-medium text-zinc-200">No games</p>
        <p className="mt-1 text-sm text-zinc-500">
          There are no live fixtures at the moment. Check back soon or browse upcoming
          markets from the home page.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <nav aria-label="Filter by sport">
        <div className="-mx-[var(--space-page)] overflow-x-auto overscroll-x-contain px-[var(--space-page)] [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-[var(--space-page-sm)] sm:px-[var(--space-page-sm)] md:-mx-[var(--space-page-lg)] md:px-[var(--space-page-lg)] [&::-webkit-scrollbar]:hidden">
          <ul
            className="flex w-max min-w-0 items-stretch gap-2 pb-1"
            role="tablist"
          >
            <li role="none">
              <button
                type="button"
                role="tab"
                aria-selected={selectedSport === "all"}
                onClick={() => setSelectedSport("all")}
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                  selectedSport === "all"
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
                }`}
              >
                <AllSportsIcon
                  className={`h-[1.125rem] w-[1.125rem] shrink-0 ${
                    selectedSport === "all" ? "text-emerald-300" : "text-zinc-300"
                  }`}
                />
                <span className="whitespace-nowrap">All</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    selectedSport === "all"
                      ? "bg-emerald-900/50 text-emerald-200/90"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {games.length}
                </span>
              </button>
            </li>
            {sportTabs.map((tab) => {
              const active = selectedSport === tab.slug;
              return (
                <li key={tab.slug} role="none">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedSport(tab.slug)}
                    className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                      active
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                        : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
                    }`}
                  >
                    <SportNavIcon
                      slug={tab.slug}
                      className={`h-[1.125rem] w-[1.125rem] shrink-0 ${
                        active ? "text-emerald-300" : "text-zinc-300"
                      }`}
                    />
                    <span className="max-w-[9rem] truncate whitespace-nowrap sm:max-w-none">
                      {tab.name}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                        active
                          ? "bg-emerald-900/50 text-emerald-200/90"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {byLeague.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-200">No games</p>
          <p className="mt-1 text-sm text-zinc-500">
            No fixtures for this sport right now. Try another filter or check back
            later.
          </p>
        </div>
      ) : null}

      {byLeague.map((league) => (
        <section
          key={league.leagueKey}
          aria-labelledby={`live-league-${league.leagueKey}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <SportNavIcon
                slug={league.sportSlug}
                className="h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-400"
              />
              <div className="min-w-0">
                <h2
                  id={`live-league-${league.leagueKey}`}
                  className="type-overline text-zinc-400"
                >
                  {league.leagueName}
                </h2>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {league.sportName} · {league.countryName}
                </p>
              </div>
            </div>
            {league.games[0] ? (
              <LeagueFavoriteButton
                sportSlug={league.games[0].sport.slug}
                countrySlug={league.games[0].country.slug}
                leagueSlug={league.leagueKey}
                title={league.leagueName}
              />
            ) : null}
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {league.games.map((game) => (
              <li key={game.gameId}>
                <LiveGameCard game={game} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
