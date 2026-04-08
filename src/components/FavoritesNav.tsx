"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";

export function FavoritesNav() {
  const { games, leagues } = useFavorites();
  if (games.length === 0 && leagues.length === 0) {
    return null;
  }

  const gameLinks = [...games].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const leagueLinks = [...leagues].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <div className="border-t border-zinc-800 px-2 pt-4">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Favorites
      </p>
      <nav aria-label="Favorite games and leagues" className="flex flex-col gap-1">
        {leagueLinks.map((l) => (
          <Link
            key={l.key}
            href={`/sports/${l.sportSlug}/${l.countrySlug}/${l.leagueSlug}`}
            className="truncate rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
          >
            {l.title}
          </Link>
        ))}
        {gameLinks.map((g) => (
          <Link
            key={g.gameId}
            href={`/games/${g.gameId}`}
            className="truncate rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
          >
            {g.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
