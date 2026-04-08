import Link from "next/link";
import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getConditionsByGameIds,
  getGamesByFilters,
  getSports,
  type GameData,
} from "@azuro-org/toolkit";
import { GameCard, extractMainLineOdds } from "@/components/GameCard";
import { LiveGameCard } from "@/components/LiveGameCard";
import { CHAIN_ID, chunk } from "@/lib/sportGames";
import { sportEmoji } from "@/lib/sportEmoji";

export const dynamic = "force-dynamic";

const CONDITIONS_BATCH = 40;
const HERO_LIVE_LIMIT = 6;
/** Fetch a bit more than we show so the feed can fill the hero grid. */
const HERO_FETCH_PER_PAGE = 24;
const POPULAR_LIMIT = 8;
const UPCOMING_LIMIT = 12;
const UPCOMING_FETCH_BUFFER = 3;
const SPORT_LINKS_MAX = 10;

function parseStartMs(startsAt: string): number {
  const n = +startsAt;
  return n < 32_503_680_000 ? n * 1000 : n;
}

async function fetchTopOddsByGameId(
  gameIds: string[],
): Promise<Map<string, ReturnType<typeof extractMainLineOdds>>> {
  const result = new Map<string, ReturnType<typeof extractMainLineOdds>>();
  if (!gameIds.length) {
    return result;
  }
  for (const batch of chunk(gameIds, CONDITIONS_BATCH)) {
    const conditions = await getConditionsByGameIds({
      chainId: CHAIN_ID,
      gameIds: batch,
    });
    const byGameId = new Map<string, typeof conditions>();
    for (const c of conditions) {
      const gid = c.game.gameId;
      const list = byGameId.get(gid);
      if (list) {
        list.push(c);
      } else {
        byGameId.set(gid, [c]);
      }
    }
    for (const gid of batch) {
      result.set(gid, extractMainLineOdds(byGameId.get(gid) ?? []));
    }
  }
  return result;
}

async function fetchHeroLiveGames(): Promise<GameData[]> {
  const res = await getGamesByFilters({
    chainId: CHAIN_ID,
    state: GameState.Live,
    orderBy: GameOrderBy.StartsAt,
    orderDir: OrderDirection.Asc,
    page: 1,
    perPage: HERO_FETCH_PER_PAGE,
  });
  return res.games.slice(0, HERO_LIVE_LIMIT);
}

async function fetchPopularGames(): Promise<GameData[]> {
  const res = await getGamesByFilters({
    chainId: CHAIN_ID,
    state: GameState.Prematch,
    orderBy: GameOrderBy.Turnover,
    orderDir: OrderDirection.Desc,
    page: 1,
    perPage: POPULAR_LIMIT,
  });
  return res.games;
}

async function fetchUpcomingGames(): Promise<GameData[]> {
  const res = await getGamesByFilters({
    chainId: CHAIN_ID,
    state: GameState.Prematch,
    orderBy: GameOrderBy.StartsAt,
    orderDir: OrderDirection.Asc,
    page: 1,
    perPage: UPCOMING_LIMIT * UPCOMING_FETCH_BUFFER,
  });
  const now = Date.now();
  const upcoming = res.games.filter((g) => parseStartMs(g.startsAt) >= now);
  return upcoming.slice(0, UPCOMING_LIMIT);
}

export default async function Home() {
  let heroGames: GameData[] = [];
  let popularGames: GameData[] = [];
  let upcomingGames: GameData[] = [];
  let sportLinks: { slug: string; name: string }[] = [];
  let heroError: string | null = null;
  let popularError: string | null = null;
  let upcomingError: string | null = null;
  let sportsError: string | null = null;

  try {
    heroGames = await fetchHeroLiveGames();
  } catch (e) {
    heroError = e instanceof Error ? e.message : "Failed to load live games.";
  }

  try {
    popularGames = await fetchPopularGames();
  } catch (e) {
    popularError = e instanceof Error ? e.message : "Failed to load popular games.";
  }

  try {
    upcomingGames = await fetchUpcomingGames();
  } catch (e) {
    upcomingError = e instanceof Error ? e.message : "Failed to load upcoming games.";
  }

  try {
    const sports = await getSports({
      chainId: CHAIN_ID,
      gameState: GameState.Prematch,
      numberOfGames: 10,
      orderBy: GameOrderBy.Turnover,
      orderDir: OrderDirection.Desc,
    });
    sportLinks = sports.slice(0, SPORT_LINKS_MAX).map((s) => ({
      slug: s.slug,
      name: s.name,
    }));
  } catch (e) {
    sportsError = e instanceof Error ? e.message : "Failed to load sports.";
  }

  const staticGameIds = [
    ...popularGames.map((g) => g.gameId),
    ...upcomingGames.map((g) => g.gameId),
  ];
  const uniqueStaticIds = [...new Set(staticGameIds)];
  let oddsByGameId = new Map<string, ReturnType<typeof extractMainLineOdds>>();
  try {
    oddsByGameId = await fetchTopOddsByGameId(uniqueStaticIds);
  } catch {
    oddsByGameId = new Map();
  }

  return (
    <div className="p-6 sm:p-8">
      <section aria-labelledby="home-hero-heading" className="mb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1
              id="home-hero-heading"
              className="text-2xl font-semibold tracking-tight text-zinc-50"
            >
              Live action
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Top in-play fixtures with updating odds.
            </p>
          </div>
          <Link
            href="/live"
            className="shrink-0 text-sm font-medium text-emerald-400/90 hover:text-emerald-300 hover:underline"
          >
            All live games
          </Link>
        </div>

        {heroError ? (
          <p className="mt-6 text-sm text-red-400" role="alert">
            {heroError}
          </p>
        ) : heroGames.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No live games right now.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {heroGames.map((game) => (
              <li key={game.gameId}>
                <LiveGameCard game={game} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {sportsError ? (
        <p className="mb-10 text-sm text-red-400" role="alert">
          {sportsError}
        </p>
      ) : sportLinks.length > 0 ? (
        <nav
          className="mb-10"
          aria-label="Sports"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Sports
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sportLinks.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/sports/${s.slug}`}
                  className="flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-center transition hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {sportEmoji(s.slug)}
                  </span>
                  <span className="max-w-[5.5rem] truncate text-[11px] font-medium text-zinc-300">
                    {s.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section aria-labelledby="popular-heading" className="mb-10">
        <h2
          id="popular-heading"
          className="text-lg font-semibold text-zinc-50"
        >
          Popular
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          High-volume markets by turnover.
        </p>
        {popularError ? (
          <p className="mt-6 text-sm text-red-400" role="alert">
            {popularError}
          </p>
        ) : popularGames.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No prematch games available.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {popularGames.map((game) => (
              <li key={game.gameId}>
                <GameCard
                  game={game}
                  topOdds={oddsByGameId.get(game.gameId) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="upcoming-heading">
        <h2
          id="upcoming-heading"
          className="text-lg font-semibold text-zinc-50"
        >
          Starting soon
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Next upcoming fixtures.
        </p>
        {upcomingError ? (
          <p className="mt-6 text-sm text-red-400" role="alert">
            {upcomingError}
          </p>
        ) : upcomingGames.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No upcoming games scheduled.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {upcomingGames.map((game) => (
              <li key={game.gameId}>
                <GameCard
                  game={game}
                  topOdds={oddsByGameId.get(game.gameId) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
