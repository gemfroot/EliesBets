"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FAVORITES_STORAGE_KEY,
  leagueKey as makeLeagueKey,
  parseFavorites,
  serializeFavorites,
  type FavoriteGame,
  type FavoriteLeague,
  type FavoritesSnapshot,
} from "@/lib/favorites";

type FavoritesContextValue = {
  games: FavoriteGame[];
  leagues: FavoriteLeague[];
  toggleGame: (game: FavoriteGame) => void;
  toggleLeague: (league: Omit<FavoriteLeague, "key">) => void;
  isGameFavorite: (gameId: string) => boolean;
  isLeagueFavorite: (
    sportSlug: string,
    countrySlug: string,
    leagueSlug: string,
  ) => boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}

function writeStorage(next: FavoritesSnapshot) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, serializeFavorites(next));
  } catch {
    /* ignore quota */
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<FavoritesSnapshot>({
    games: [],
    leagues: [],
  });

  useEffect(() => {
    // Hydrate from localStorage after mount (browser-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time read
    setSnapshot(parseFavorites(localStorage.getItem(FAVORITES_STORAGE_KEY)));
  }, []);

  const toggleGame = useCallback((game: FavoriteGame) => {
    setSnapshot((prev) => {
      const nextGames = prev.games.some((g) => g.gameId === game.gameId)
        ? prev.games.filter((g) => g.gameId !== game.gameId)
        : [...prev.games, game];
      const next = { ...prev, games: nextGames };
      writeStorage(next);
      return next;
    });
  }, []);

  const toggleLeague = useCallback((league: Omit<FavoriteLeague, "key">) => {
    setSnapshot((prev) => {
      const key = makeLeagueKey(
        league.sportSlug,
        league.countrySlug,
        league.leagueSlug,
      );
      const exists = prev.leagues.some((l) => l.key === key);
      const nextLeagues = exists
        ? prev.leagues.filter((l) => l.key !== key)
        : [
            ...prev.leagues,
            {
              key,
              sportSlug: league.sportSlug,
              countrySlug: league.countrySlug,
              leagueSlug: league.leagueSlug,
              title: league.title,
            },
          ];
      const next = { ...prev, leagues: nextLeagues };
      writeStorage(next);
      return next;
    });
  }, []);

  const isGameFavorite = useCallback(
    (gameId: string) => snapshot.games.some((g) => g.gameId === gameId),
    [snapshot.games],
  );

  const isLeagueFavorite = useCallback(
    (sportSlug: string, countrySlug: string, leagueSlug: string) => {
      const k = makeLeagueKey(sportSlug, countrySlug, leagueSlug);
      return snapshot.leagues.some((l) => l.key === k);
    },
    [snapshot.leagues],
  );

  const value = useMemo(
    () => ({
      games: snapshot.games,
      leagues: snapshot.leagues,
      toggleGame,
      toggleLeague,
      isGameFavorite,
      isLeagueFavorite,
    }),
    [
      snapshot.games,
      snapshot.leagues,
      toggleGame,
      toggleLeague,
      isGameFavorite,
      isLeagueFavorite,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}
