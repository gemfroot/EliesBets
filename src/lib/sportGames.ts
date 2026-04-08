import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  getSports,
  type GameData,
  type SportData,
} from "@azuro-org/toolkit";
import { CHAIN_ID } from "@/lib/constants";
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
  leagueSlug?: string,
): Promise<GameData[]> {
  const collected: GameData[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await getGamesByFilters({
      chainId: CHAIN_ID,
      state,
      sportSlug,
      ...(leagueSlug ? { leagueSlug } : {}),
      orderBy: GameOrderBy.StartsAt,
      orderDir: OrderDirection.Asc,
      page,
      perPage: GAMES_PER_PAGE,
    });
    collected.push(...res.games);
    totalPages = res.totalPages;
    page += 1;
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

export async function fetchGamesForSport(sportSlug: string): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForPaginatedState(sportSlug, GameState.Prematch),
    fetchGamesForPaginatedState(sportSlug, GameState.Live),
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
): Promise<GameData[]> {
  const sports = await getSports({
    chainId: CHAIN_ID,
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
): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForSportCountryState(sportSlug, countrySlug, GameState.Prematch),
    fetchGamesForSportCountryState(sportSlug, countrySlug, GameState.Live),
  ]).then((parts) => parts.flat());
  return dedupeGames(collected);
}

export async function fetchGamesForLeague(
  sportSlug: string,
  leagueSlug: string,
): Promise<GameData[]> {
  const collected = await Promise.all([
    fetchGamesForPaginatedState(sportSlug, GameState.Prematch, leagueSlug),
    fetchGamesForPaginatedState(sportSlug, GameState.Live, leagueSlug),
  ]).then((parts) => parts.flat());
  return dedupeGames(collected);
}
