import { getConditionsByGameIds, type GameData } from "@azuro-org/toolkit";
import Link from "next/link";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard } from "@/components/GameCard";
import { extractMainLineOdds } from "@/lib/oddsUtils";
import { RetryCallout } from "@/components/RetryCallout";
import { CHAIN_ID } from "@/lib/constants";
import { chunk, fetchGamesForSportCountry } from "@/lib/sportGames";

export const revalidate = 45;

type Props = {
  params: Promise<{ slug: string; country: string }>;
};

const CONDITIONS_BATCH = 40;

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

export default async function SportCountryPage({ params }: Props) {
  const { slug, country: countrySlug } = await params;
  const sportTitle = titleFromSlug(slug);

  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchGamesForSportCountry(slug, countrySlug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load games.";
  }

  const countryName =
    games[0]?.country.name ?? titleFromSlug(countrySlug);

  const oddsByGameId = loadError
    ? new Map<string, ReturnType<typeof extractMainLineOdds>>()
    : await fetchTopOddsByGameId(games.map((g) => g.gameId));

  const byLeague = groupGamesByLeague(games);

  return (
    <div className="page-shell">
      <p className="type-muted">
        <Link href={`/sports/${slug}`} className="hover:text-zinc-300">
          {sportTitle}
        </Link>
        <span className="text-zinc-600"> · </span>
        <span className="text-zinc-400">{countryName}</span>
      </p>
      <h1 className="type-display mt-2">{countryName}</h1>
      <p className="type-muted mt-1">
        {sportTitle} · {countrySlug}
      </p>

      {loadError ? (
        <RetryCallout
          className="mt-6"
          title="Could not load games"
          description={loadError}
        />
      ) : games.length === 0 ? (
        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6">
          <p className="text-sm font-medium text-zinc-200">No games</p>
          <p className="mt-1 text-sm text-zinc-500">
            No fixtures for this country yet. Pick a different region or browse other
            leagues.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {byLeague.map((league) => (
            <section key={league.leagueKey} aria-labelledby={`league-${league.leagueKey}`}>
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <h2
                  id={`league-${league.leagueKey}`}
                  className="type-overline text-zinc-400"
                >
                  <Link
                    href={`/sports/${slug}/${countrySlug}/${league.leagueKey}`}
                    className="hover:text-zinc-200"
                  >
                    {league.leagueName}
                  </Link>
                </h2>
                <LeagueFavoriteButton
                  sportSlug={slug}
                  countrySlug={countrySlug}
                  leagueSlug={league.leagueKey}
                  title={league.leagueName}
                />
              </div>
              <ul className="mt-4 flex flex-col gap-2">
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
