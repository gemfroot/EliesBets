"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function countCountryGames(country: SportData["countries"][number]): number {
  return country.leagues.reduce((sum, league) => sum + league.games.length, 0);
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

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block text-[10px] text-zinc-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden
    >
      ▶
    </span>
  );
}

export function SportsList() {
  const { data: sports, isLoading, isError } = useSports({
    isLive: false,
    filter: { maxGamesPerLeague: 10 },
    sortLeaguesAndCountriesByName: true,
  });

  const [openSportIds, setOpenSportIds] = useState<Set<number>>(() => new Set());
  const [openCountryKeys, setOpenCountryKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const sportIdList = useMemo(
    () => (sports ?? []).map((s) => s.id),
    [sports],
  );

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

  function toggleSport(id: number) {
    setOpenSportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCountry(key: string) {
    setOpenCountryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Sports">
      <div className="flex justify-end px-1 pb-1">
        <button
          type="button"
          onClick={() => {
            setOpenSportIds(new Set());
            setOpenCountryKeys(new Set());
          }}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          Collapse all
        </button>
        <span className="mx-1 text-zinc-700">|</span>
        <button
          type="button"
          onClick={() => {
            setOpenSportIds(new Set(sportIdList));
            const keys = new Set<string>();
            for (const s of sports) {
              for (const c of s.countries) {
                keys.add(`${s.slug}:${c.slug}`);
              }
            }
            setOpenCountryKeys(keys);
          }}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          Expand all
        </button>
      </div>
      {sports.map((sport) => {
        const n = countGames(sport);
        const sportOpen = openSportIds.has(sport.id);
        return (
          <div key={sport.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5 rounded-lg pr-1 hover:bg-zinc-900/80">
              <button
                type="button"
                onClick={() => toggleSport(sport.id)}
                className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                aria-expanded={sportOpen}
                aria-label={sportOpen ? `Collapse ${sport.name}` : `Expand ${sport.name}`}
              >
                <Chevron open={sportOpen} />
              </button>
              <Link
                href={`/sports/${sport.slug}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-0.5 pr-2 text-left text-sm text-zinc-300 transition hover:text-zinc-50"
              >
                <span className="min-w-0 truncate">{sport.name}</span>
                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-300">
                  {n}
                </span>
              </Link>
            </div>
            {sportOpen ? (
              <ul className="ml-2 flex flex-col gap-0.5 border-l border-zinc-800 pl-2">
                {sport.countries.map((country) => {
                  const cn = countCountryGames(country);
                  const cKey = `${sport.slug}:${country.slug}`;
                  const countryOpen = openCountryKeys.has(cKey);
                  return (
                    <li key={cKey}>
                      <div className="flex items-center gap-0.5 rounded-lg pr-1 hover:bg-zinc-900/80">
                        <button
                          type="button"
                          onClick={() => toggleCountry(cKey)}
                          className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                          aria-expanded={countryOpen}
                          aria-label={
                            countryOpen
                              ? `Collapse ${country.name}`
                              : `Expand ${country.name}`
                          }
                        >
                          <Chevron open={countryOpen} />
                        </button>
                        <Link
                          href={`/sports/${sport.slug}/${country.slug}`}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pl-0.5 pr-2 text-left text-xs text-zinc-400 transition hover:text-zinc-100"
                        >
                          <span className="min-w-0 truncate">{country.name}</span>
                          <span className="shrink-0 tabular-nums text-zinc-500">
                            {cn}
                          </span>
                        </Link>
                      </div>
                      {countryOpen ? (
                        <ul className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-800/80 pl-2">
                          {country.leagues.map((league) => (
                            <li key={league.slug}>
                              <Link
                                href={`/sports/${sport.slug}/${country.slug}/${league.slug}`}
                                className="block truncate rounded py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
                              >
                                {league.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
