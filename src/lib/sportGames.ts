import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  type GameData,
} from "@azuro-org/toolkit";
import { CHAIN_ID } from "@/lib/constants";
export const GAMES_PER_PAGE = 100;

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
