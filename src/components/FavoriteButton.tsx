"use client";

import { useFavorites } from "@/components/FavoritesProvider";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className="h-[1.1em] w-[1.1em]"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.611l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    </svg>
  );
}

export function FavoriteGameButton({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const { isGameFavorite, toggleGame } = useFavorites();
  const active = isGameFavorite(gameId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleGame({ gameId, title });
      }}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded p-1 transition-colors ${
        active
          ? "text-amber-400 hover:text-amber-300"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
      aria-pressed={active}
      aria-label={active ? "Remove game from favorites" : "Add game to favorites"}
    >
      <StarIcon filled={active} />
    </button>
  );
}

export function LeagueFavoriteButton({
  sportSlug,
  countrySlug,
  leagueSlug,
  title,
}: {
  sportSlug: string;
  countrySlug: string;
  leagueSlug: string;
  title: string;
}) {
  const { isLeagueFavorite, toggleLeague } = useFavorites();
  const active = isLeagueFavorite(sportSlug, countrySlug, leagueSlug);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLeague({ sportSlug, countrySlug, leagueSlug, title });
      }}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded p-1 transition-colors ${
        active
          ? "text-amber-400 hover:text-amber-300"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
      aria-pressed={active}
      aria-label={
        active ? "Remove league from favorites" : "Add league to favorites"
      }
    >
      <StarIcon filled={active} />
    </button>
  );
}
