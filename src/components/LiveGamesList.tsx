"use client";

import type { GameData } from "@azuro-org/toolkit";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { LiveGameCard } from "@/components/LiveGameCard";
import { RetryCallout } from "@/components/RetryCallout";

type LeagueGroup = { leagueKey: string; leagueName: string; games: GameData[] };

function groupGamesByLeague(games: GameData[]): LeagueGroup[] {
  const map = new Map<string, LeagueGroup>();
  for (const game of games) {
    const leagueKey = game.league.slug;
    const leagueName = game.league.name;
    let group = map.get(leagueKey);
    if (!group) {
      group = { leagueKey, leagueName, games: [] };
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

  const byLeague = groupGamesByLeague(games);

  return (
    <div className="mt-8 flex flex-col gap-8">
      {byLeague.map((league) => (
        <section
          key={league.leagueKey}
          aria-labelledby={`live-league-${league.leagueKey}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <h2
              id={`live-league-${league.leagueKey}`}
              className="type-overline text-zinc-400"
            >
              {league.leagueName}
            </h2>
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
