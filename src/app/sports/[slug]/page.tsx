import { getConditionsByGameIds, type GameData } from "@azuro-org/toolkit";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard, extractMainLineOdds } from "@/components/GameCard";
import {
  CHAIN_ID,
  chunk,
  fetchGamesForSport,
} from "@/lib/sportGames";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

const CONDITIONS_BATCH = 40;

async function fetchTopOddsByGameId(
  gameIds: string[],
): Promise<Map<string, ReturnType<typeof extractMainLineOdds>>> {
  const result = new Map<string, ReturnType<typeof extractMainLineOdds>>();
  if (!gameIds.length) {
    return result;
  }
  for (const batch of chunk(gameIds, CONDITIONS_BATCH)) {
    const conditions = await getConditionsByGameIds({
      chainId: CHAIN_ID,
      gameIds: batch,
    });
    const byGameId = new Map<string, typeof conditions>();
    for (const c of conditions) {
      const gid = c.game.gameId;
      const list = byGameId.get(gid);
      if (list) {
        list.push(c);
      } else {
        byGameId.set(gid, [c]);
      }
    }
    for (const gid of batch) {
      result.set(gid, extractMainLineOdds(byGameId.get(gid) ?? []));
    }
  }
  return result;
}

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

export default async function SportPage({ params }: Props) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchGamesForSport(slug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load games.";
  }

  const oddsByGameId = loadError
    ? new Map<string, ReturnType<typeof extractMainLineOdds>>()
    : await fetchTopOddsByGameId(games.map((g) => g.gameId));

  const byLeague = groupGamesByLeague(games);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-50">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Sport: {slug}</p>

      {loadError ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : games.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No games scheduled.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {byLeague.map((league) => (
            <section key={league.leagueKey} aria-labelledby={`league-${league.leagueKey}`}>
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h2
                  id={`league-${league.leagueKey}`}
                  className="text-sm font-semibold uppercase tracking-wider text-zinc-400"
                >
                  {league.leagueName}
                </h2>
                {league.games[0] ? (
                  <LeagueFavoriteButton
                    sportSlug={slug}
                    countrySlug={league.games[0].country.slug}
                    leagueSlug={league.leagueKey}
                    title={league.leagueName}
                  />
                ) : null}
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {league.games.map((game) => (
                  <li key={game.gameId}>
                    <GameCard
                      game={game}
                      topOdds={oddsByGameId.get(game.gameId) ?? null}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
