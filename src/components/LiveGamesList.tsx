"use client";

import type { GameData } from "@azuro-org/toolkit";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { LiveGameCard } from "@/components/LiveGameCard";

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
      <p className="mt-6 text-sm text-red-400" role="alert">
        {loadError}
      </p>
    );
  }

  if (!games.length) {
    return (
      <p className="mt-6 text-sm text-zinc-500">No live games right now.</p>
    );
  }

  const byLeague = groupGamesByLeague(games);

  return (
    <div className="mt-8 flex flex-col gap-10">
      {byLeague.map((league) => (
        <section
          key={league.leagueKey}
          aria-labelledby={`live-league-${league.leagueKey}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <h2
              id={`live-league-${league.leagueKey}`}
              className="text-sm font-semibold uppercase tracking-wider text-zinc-400"
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
          <ul className="mt-4 flex flex-col gap-3">
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
