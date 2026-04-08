export const FAVORITES_STORAGE_KEY = "eliesbets-favorites-v1";

export type FavoriteGame = {
  gameId: string;
  title: string;
};

export type FavoriteLeague = {
  key: string;
  sportSlug: string;
  countrySlug: string;
  leagueSlug: string;
  title: string;
};

export type FavoritesSnapshot = {
  games: FavoriteGame[];
  leagues: FavoriteLeague[];
};

function leagueKey(
  sportSlug: string,
  countrySlug: string,
  leagueSlug: string,
): string {
  return `${sportSlug}::${countrySlug}::${leagueSlug}`;
}

export { leagueKey };

export function parseFavorites(raw: string | null): FavoritesSnapshot {
  if (!raw) {
    return { games: [], leagues: [] };
  }
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") {
      return { games: [], leagues: [] };
    }
    const obj = data as Record<string, unknown>;
    const gamesRaw = obj.games;
    const leaguesRaw = obj.leagues;
    const games: FavoriteGame[] = Array.isArray(gamesRaw)
      ? gamesRaw.filter(
          (g): g is FavoriteGame =>
            !!g &&
            typeof g === "object" &&
            typeof (g as FavoriteGame).gameId === "string" &&
            typeof (g as FavoriteGame).title === "string",
        )
      : [];
    const leagues: FavoriteLeague[] = Array.isArray(leaguesRaw)
      ? leaguesRaw.filter(
          (l): l is FavoriteLeague =>
            !!l &&
            typeof l === "object" &&
            typeof (l as FavoriteLeague).key === "string" &&
            typeof (l as FavoriteLeague).sportSlug === "string" &&
            typeof (l as FavoriteLeague).countrySlug === "string" &&
            typeof (l as FavoriteLeague).leagueSlug === "string" &&
            typeof (l as FavoriteLeague).title === "string",
        )
      : [];
    return { games, leagues };
  } catch {
    return { games: [], leagues: [] };
  }
}

export function serializeFavorites(snapshot: FavoritesSnapshot): string {
  return JSON.stringify(snapshot);
}
