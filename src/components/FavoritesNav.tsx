"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import { useChainSlug } from "@/lib/useChainSlug";

const ROW_CLASS =
  "group flex items-center gap-1 rounded-md pl-2 pr-1 hover:bg-zinc-900";
const LINK_CLASS =
  "min-w-0 flex-1 truncate py-1.5 text-sm text-zinc-300 group-hover:text-zinc-50";
const REMOVE_BTN_CLASS =
  "shrink-0 rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100";

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
  const { games, leagues, toggleGame, toggleLeague } = useFavorites();
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

  // On touch / sheet variants the hover-to-reveal "×" button is useless,
  // so pin it visible there.
  const removeBtnVariantClass =
    variant === "sheet" ? `${REMOVE_BTN_CLASS} opacity-100` : REMOVE_BTN_CLASS;

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
        <div key={l.key} className={ROW_CLASS}>
          <Link
            href={`/${chain}/sports/${l.sportSlug}/${l.countrySlug}/${l.leagueSlug}`}
            className={LINK_CLASS}
            onClick={onFavoriteNavigate}
          >
            {l.title}
          </Link>
          <button
            type="button"
            className={removeBtnVariantClass}
            aria-label={`Remove ${l.title} from favorites`}
            title="Remove favorite"
            onClick={() =>
              toggleLeague({
                sportSlug: l.sportSlug,
                countrySlug: l.countrySlug,
                leagueSlug: l.leagueSlug,
                title: l.title,
              })
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      ))}
      {gameLinks.map((g) => (
        <div key={g.gameId} className={ROW_CLASS}>
          <Link
            href={`/games/${g.gameId}`}
            className={LINK_CLASS}
            onClick={onFavoriteNavigate}
          >
            {g.title}
          </Link>
          <button
            type="button"
            className={removeBtnVariantClass}
            aria-label={`Remove ${g.title} from favorites`}
            title="Remove favorite"
            onClick={() => toggleGame({ gameId: g.gameId, title: g.title })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
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
