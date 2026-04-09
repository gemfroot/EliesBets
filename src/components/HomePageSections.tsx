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
import { GameCard } from "@/components/GameCard";
import { extractMainLineOdds } from "@/lib/oddsUtils";
import { LiveGameCard } from "@/components/LiveGameCard";
import { RetryCallout } from "@/components/RetryCallout";
import { CHAIN_ID } from "@/lib/constants";
import { chunk } from "@/lib/sportGames";
import { SportNavIcon } from "@/lib/sportNavIcon";

const CONDITIONS_BATCH = 40;
const HERO_LIVE_LIMIT = 6;
const HERO_FETCH_PER_PAGE = 24;
const POPULAR_LIMIT = 8;
const API_MIN_PER_PAGE = 10;
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
    perPage: Math.max(POPULAR_LIMIT, API_MIN_PER_PAGE),
  });
  return res.games.slice(0, POPULAR_LIMIT);
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

/** Live hero: streamed behind Suspense so the shell can render immediately. */
export async function HomeHeroSection() {
  let heroGames: GameData[] = [];
  let heroError: string | null = null;

  try {
    heroGames = await fetchHeroLiveGames();
  } catch (e) {
    heroError = e instanceof Error ? e.message : "Failed to load live games.";
  }

  return (
    <section aria-labelledby="home-hero-heading" className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 id="home-hero-heading" className="type-display">
            Live action
          </h1>
          <p className="type-muted mt-1">
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
        <RetryCallout
          className="mt-6"
          title="Could not load live games"
          description={heroError}
        />
      ) : heroGames.length === 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-5">
          <p className="text-sm font-medium text-zinc-200">No games</p>
          <p className="mt-1 text-sm text-zinc-500">
            No live fixtures right now. Try popular or upcoming below, or open the live
            page later.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {heroGames.map((game) => (
            <li key={game.gameId} className="min-w-0">
              <LiveGameCard game={game} variant="heroLive" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Sports quick links: separate Suspense boundary from hero and game lists. */
export async function HomeSportsNavSection() {
  let sportLinks: { slug: string; name: string }[] = [];
  let sportsError: string | null = null;

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

  if (sportsError) {
    return (
      <div className="mb-8">
        <RetryCallout title="Could not load sports" description={sportsError} />
      </div>
    );
  }

  if (sportLinks.length === 0) {
    return null;
  }

  return (
    <nav className="mb-8" aria-label="Sports">
      <ul className="flex flex-wrap gap-2">
        {sportLinks.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/sports/${s.slug}`}
              className="flex min-h-[44px] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-center transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              <SportNavIcon
                slug={s.slug}
                className="h-6 w-6 shrink-0 text-zinc-300"
              />
              <span className="max-w-[5.5rem] truncate text-[11px] font-medium text-zinc-300">
                {s.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Popular + upcoming lists share one conditions fetch for odds. */
export async function HomePopularUpcomingSections() {
  let popularGames: GameData[] = [];
  let upcomingGames: GameData[] = [];
  let popularError: string | null = null;
  let upcomingError: string | null = null;

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
    <>
      <section aria-labelledby="popular-heading" className="mb-8">
        <h2 id="popular-heading" className="type-title">
          Popular
        </h2>
        <p className="type-muted mt-0.5">High-volume markets by turnover.</p>
        {popularError ? (
          <RetryCallout
            className="mt-6"
            title="Could not load popular games"
            description={popularError}
          />
        ) : popularGames.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-5">
            <p className="text-sm font-medium text-zinc-200">No games</p>
            <p className="mt-1 text-sm text-zinc-500">
              No prematch fixtures are listed yet. Refresh later or explore other sports
              in the sidebar.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
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
        <h2 id="upcoming-heading" className="type-title">
          Starting soon
        </h2>
        <p className="type-muted mt-0.5">Next upcoming fixtures.</p>
        {upcomingError ? (
          <RetryCallout
            className="mt-6"
            title="Could not load upcoming games"
            description={upcomingError}
          />
        ) : upcomingGames.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-5">
            <p className="text-sm font-medium text-zinc-200">No games</p>
            <p className="mt-1 text-sm text-zinc-500">
              Nothing scheduled in this feed yet. Check other dates or sports from the
              navigation.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
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
    </>
  );
}
