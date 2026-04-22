"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import { useChainSlug } from "@/lib/useChainSlug";

const LINK_CLASS =
  "truncate rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50";

type FavoritesNavProps = {
  variant?: "sidebar" | "sheet";
  /** Called when a favorite link is activated (e.g. to close a mobile sheet). */
  onFavoriteNavigate?: () => void;
};

export function FavoritesNav({
  variant = "sidebar",
  onFavoriteNavigate,
}: FavoritesNavProps) {
  const chain = useChainSlug();
  const { games, leagues } = useFavorites();
  const isEmpty = games.length === 0 && leagues.length === 0;

  if (variant === "sidebar" && isEmpty) {
    return null;
  }

  const gameLinks = [...games].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const leagueLinks = [...leagues].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  if (variant === "sheet" && isEmpty) {
    return (
      <div className="px-4 pb-6 pt-2">
        <p className="pb-3 text-center text-sm text-zinc-400">
          No favorites yet. Use the star on a league or game to save it here.
        </p>
      </div>
    );
  }

  const list = (
    <nav aria-label="Favorite games and leagues" className="flex flex-col gap-1">
      {leagueLinks.map((l) => (
        <Link
          key={l.key}
          href={`/${chain}/sports/${l.sportSlug}/${l.countrySlug}/${l.leagueSlug}`}
          className={LINK_CLASS}
          onClick={onFavoriteNavigate}
        >
          {l.title}
        </Link>
      ))}
      {gameLinks.map((g) => (
        <Link
          key={g.gameId}
          href={`/games/${g.gameId}`}
          className={LINK_CLASS}
          onClick={onFavoriteNavigate}
        >
          {g.title}
        </Link>
      ))}
    </nav>
  );

  if (variant === "sheet") {
    return (
      <div className="px-4 pb-4 pt-2">
        <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Favorites
        </p>
        {list}
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800 px-2 pt-4">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Favorites
      </p>
      {list}
    </div>
  );
}
