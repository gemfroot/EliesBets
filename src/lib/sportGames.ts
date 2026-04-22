import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  getSports,
  type GameData,
  type SportData,
} from "@azuro-org/toolkit";
import type { SportsChainId } from "@/lib/sportsChainConstants";

export const GAMES_PER_PAGE = 100;

/** Games per league from the sports tree API; must be high enough for full country listings. */
const COUNTRY_TREE_GAMES_PER_LEAGUE = 1000;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function fetchGamesForPaginatedState(
  sportSlug: string,
  state: GameState.Prematch | GameState.Live,
  chainId: SportsChainId,
  leagueSlug?: string,
): Promise<GameData[]> {
  const baseParams = {
    chainId,
    state,
    sportSlug,
    ...(leagueSlug ? { leagueSlug } : {}),
    orderBy: GameOrderBy.StartsAt,
    orderDir: OrderDirection.Asc,
    perPage: GAMES_PER_PAGE,
  } as const;
  const first = await getGamesByFilters({ ...baseParams, page: 1 });
  if (first.totalPages <= 1) {
    return first.games;
  }
  // Sequential pagination made popular sports (baseball, football) block SSR for
  // 10–30s on a slow upstream. Fetch remaining pages in parallel.
  const remainingPages = Array.from(
    { length: first.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(
    remainingPages.map((page) => getGamesByFilters({ ...baseParams, page })),
  );
  const collected: GameData[] = [...first.games];
  for (const res of rest) {
    collected.push(...res.games);
  }
  return collected;
}

function dedupeGames(games: GameData[]): GameData[] {
  const seen = new Set<string>();
  return games.filter((g) => {
    if (seen.has(g.gameId)) {
      return false;
    }
    seen.add(g.gameId);
    return true;
  });
}

export async function fetchGamesForSport(
  sportSlug: string,
  chainId: SportsChainId,
): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForPaginatedState(sportSlug, GameState.Prematch, chainId),
    fetchGamesForPaginatedState(sportSlug, GameState.Live, chainId),
  ]).then((parts) => parts.flat());
  return dedupeGames(collected);
}

function collectGamesForCountryFromSportsTree(
  sportSlug: string,
  countrySlug: string,
  sports: SportData[],
): GameData[] {
  const games: GameData[] = [];
  for (const sport of sports) {
    if (sport.slug !== sportSlug) {
      continue;
    }
    for (const country of sport.countries) {
      if (country.slug !== countrySlug) {
        continue;
      }
      for (const league of country.leagues) {
        games.push(...league.games);
      }
    }
  }
  return games;
}

async function fetchGamesForSportCountryState(
  sportSlug: string,
  countrySlug: string,
  state: GameState.Prematch | GameState.Live,
  chainId: SportsChainId,
): Promise<GameData[]> {
  const sports = await getSports({
    chainId,
    gameState: state,
    sportSlug,
    countrySlug,
    numberOfGames: COUNTRY_TREE_GAMES_PER_LEAGUE,
    orderBy: GameOrderBy.StartsAt,
    orderDir: OrderDirection.Asc,
  });
  return collectGamesForCountryFromSportsTree(sportSlug, countrySlug, sports);
}

/**
 * Games for a single country under a sport (server-filtered via toolkit `getSports`),
 * without loading every game for the sport.
 */
export async function fetchGamesForSportCountry(
  sportSlug: string,
  countrySlug: string,
  chainId: SportsChainId,
): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForSportCountryState(
      sportSlug,
      countrySlug,
      GameState.Prematch,
      chainId,
    ),
    fetchGamesForSportCountryState(
      sportSlug,
      countrySlug,
      GameState.Live,
      chainId,
    ),
  ]).then((parts) => parts.flat());
  return dedupeGames(collected);
}

export async function fetchGamesForLeague(
  sportSlug: string,
  leagueSlug: string,
  chainId: SportsChainId,
): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForPaginatedState(sportSlug, GameState.Prematch, chainId, leagueSlug),
    fetchGamesForPaginatedState(sportSlug, GameState.Live, chainId, leagueSlug),
  ]).then((parts) => parts.flat());
  return dedupeGames(collected);
}
