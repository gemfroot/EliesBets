"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

const MIN_QUERY = 3;

type GamePayload = {
  gameId: string;
  title: string;
  sport: { slug: string; name: string };
  league: { slug: string; name: string };
  country: { slug: string; name: string };
  participants: { name: string }[];
};

export type SearchResultItem = {
  id: string;
  kind: "game" | "league" | "team";
  href: string;
  primary: string;
  secondary: string;
};

function participantLine(game: GamePayload): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase());
}

function leagueKey(g: GamePayload): string {
  return `${g.sport.slug}|${g.country.slug}|${g.league.slug}`;
}

function buildItems(games: GamePayload[], q: string): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seenLeague = new Set<string>();
  const seenTeam = new Set<string>();

  for (const game of games.slice(0, 8)) {
    items.push({
      id: `game-${game.gameId}`,
      kind: "game",
      href: `/games/${game.gameId}`,
      primary: participantLine(game),
      secondary: `${game.league.name} · ${game.sport.name}`,
    });
  }

  const leagueCandidates: GamePayload[] = [];
  const byLeague = new Map<string, GamePayload>();
  for (const game of games) {
    const key = leagueKey(game);
    if (!byLeague.has(key)) {
      byLeague.set(key, game);
    }
  }
  for (const game of byLeague.values()) {
    if (
      matchesQuery(game.league.name, q) ||
      matchesQuery(game.country.name, q) ||
      matchesQuery(game.sport.name, q)
    ) {
      leagueCandidates.push(game);
    }
  }
  for (const game of leagueCandidates.slice(0, 5)) {
    const key = leagueKey(game);
    if (seenLeague.has(key)) continue;
    seenLeague.add(key);
    items.push({
      id: `league-${key}`,
      kind: "league",
      href: `/sports/${game.sport.slug}/${game.country.slug}/${game.league.slug}`,
      primary: game.league.name,
      secondary: `${game.sport.name} · ${game.country.name}`,
    });
  }

  for (const game of games) {
    for (const p of game.participants) {
      if (!matchesQuery(p.name, q)) continue;
      const tKey = `${leagueKey(game)}|${p.name.toLowerCase()}`;
      if (seenTeam.has(tKey)) continue;
      seenTeam.add(tKey);
      items.push({
        id: `team-${tKey}`,
        kind: "team",
        href: `/games/${game.gameId}`,
        primary: p.name,
        secondary: `${game.league.name} · ${game.sport.name}`,
      });
      if (seenTeam.size >= 5) break;
    }
    if (seenTeam.size >= 5) break;
  }

  return items;
}

const KIND_LABEL: Record<SearchResultItem["kind"], string> = {
  game: "Game",
  league: "League",
  team: "Team",
};

export function SearchBar() {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<GamePayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchSettled, setSearchSettled] = useState(false);

  const trimmed = query.trim();
  const items = useMemo(() => {
    const activeGames = trimmed.length >= MIN_QUERY ? games : [];
    return buildItems(activeGames, trimmed);
  }, [games, trimmed]);
  const showLoading = trimmed.length >= MIN_QUERY && loading;
  const showError = trimmed.length >= MIN_QUERY ? fetchError : null;

  const safeHighlight =
    items.length === 0 ? 0 : Math.min(highlight, items.length - 1);

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) {
      searchRequestId.current += 1;
      queueMicrotask(() => {
        setGames([]);
        setFetchError(null);
        setLoading(false);
        setSearchSettled(false);
      });
      return;
    }

    queueMicrotask(() => {
      setSearchSettled(false);
    });
    const myId = ++searchRequestId.current;
    const t = window.setTimeout(() => {
      if (searchRequestId.current !== myId) {
        return;
      }
      setLoading(true);
      setFetchError(null);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(body?.error ?? "Search failed");
          }
          return res.json() as Promise<{ games: GamePayload[] }>;
        })
        .then((data) => {
          if (searchRequestId.current !== myId) {
            return;
          }
          setGames(data.games ?? []);
          setHighlight(0);
        })
        .catch((e: unknown) => {
          if (searchRequestId.current !== myId) {
            return;
          }
          setGames([]);
          setFetchError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (searchRequestId.current !== myId) {
            return;
          }
          setLoading(false);
          setSearchSettled(true);
        });
    }, 280);

    return () => window.clearTimeout(t);
  }, [trimmed]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function onChange() {
      if (mq.matches) {
        setMobileSearchOpen(false);
      }
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const showPanel = Boolean(
    open &&
      trimmed.length >= MIN_QUERY &&
      (showLoading ||
        Boolean(showError) ||
        items.length > 0 ||
        searchSettled),
  );

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setMobileSearchOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (trimmed.length < MIN_QUERY) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!items.length) return;
      setOpen(true);
      setHighlight((h) => (h + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      setOpen(true);
      setHighlight((h) => (h - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      if (!items.length) return;
      e.preventDefault();
      go(items[safeHighlight]!.href);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setMobileSearchOpen(false);
    }
  };

  const inputId = `${listId}-input`;
  const showInputDesktop = "hidden min-w-0 flex-1 md:block";
  const showInputMobile =
    mobileSearchOpen ? "block min-w-0 flex-1" : showInputDesktop;

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-md">
      <div
        className={`flex w-full items-center gap-2 ${
          mobileSearchOpen ? "" : "justify-center md:justify-start"
        }`}
      >
        <div className={showInputMobile}>
          <label className="sr-only" htmlFor={inputId}>
            Search games, teams, and leagues
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            placeholder="Search games, teams, leagues…"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            role="combobox"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="button"
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/80 text-zinc-300 transition hover:bg-zinc-800 md:hidden"
          aria-expanded={mobileSearchOpen}
          aria-controls={inputId}
          aria-label={mobileSearchOpen ? "Close search" : "Open search"}
          onClick={() => setMobileSearchOpen((v) => !v)}
        >
          {mobileSearchOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </button>
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-lg shadow-black/40"
        >
          {showLoading ? (
            <p className="px-3 py-2 text-xs text-zinc-500">Searching…</p>
          ) : null}
          {showError ? (
            <p className="px-3 py-2 text-xs text-red-400" role="alert">
              {showError}
            </p>
          ) : null}
          {!showLoading && !showError && items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500">No matches.</p>
          ) : null}
          {items.map((item, i) => (
            <div
              key={item.id}
              role="option"
              aria-selected={i === safeHighlight}
              className={`border-b border-zinc-800/80 last:border-b-0 ${
                i === safeHighlight ? "bg-zinc-800/80" : ""
              }`}
            >
              <Link
                href={item.href}
                className="flex flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-zinc-800/60"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="truncate font-medium text-zinc-100">
                    {item.primary}
                  </span>
                </span>
                <span className="truncate text-xs text-zinc-500">
                  {item.secondary}
                </span>
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
