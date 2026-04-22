import { Suspense } from "react";
import type { GameData } from "@azuro-org/toolkit";
import { notFound } from "next/navigation";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard } from "@/components/GameCard";
import { fetchTopOddsByGameId, type GameOddsData } from "@/lib/oddsUtils";
import { RetryCallout } from "@/components/RetryCallout";
import { GameCardListSkeleton } from "@/components/Skeleton";
import { fetchGamesForSport } from "@/lib/sportGames";
import { formatServerFetchError } from "@/lib/serverFetchError";
import {
  CHAIN_SLUGS,
  chainIdFromSlug,
  isChainSlug,
  type ChainSlug,
} from "@/lib/sportsChainConstants";
import type { Metadata } from "next";

/**
 * Chain + slug come from the URL, so Vercel can cache per-variant HTML at
 * the edge. We pre-generate (chain × top-sport) tuples at build time so the
 * common sports are served from cached HTML on the first visit; uncommon
 * sports still work via on-demand ISR (`dynamicParams = true` is default).
 *
 * 45s TTL matches the data-layer `unstable_cache` in `sportGames.ts`.
 */
export const revalidate = 45;

/** Hardcoded so the build doesn't depend on Azuro's upstream being healthy. */
const PREGENERATED_SPORT_SLUGS = [
  "soccer",
  "basketball",
  "baseball",
  "american-football",
  "ice-hockey",
  "tennis",
  "mma",
  "boxing",
  "rugby",
  "cricket",
  "volleyball",
  "handball",
  "esports",
] as const;

export function generateStaticParams() {
  const out: { chain: ChainSlug; slug: string }[] = [];
  for (const chain of CHAIN_SLUGS) {
    for (const slug of PREGENERATED_SPORT_SLUGS) {
      out.push({ chain, slug });
    }
  }
  return out;
}

type Props = {
  params: Promise<{ chain: string; slug: string }>;
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromSlug(slug);
  return {
    title: `${title} betting`,
    description: `Browse ${title} fixtures, leagues, and live or prematch odds on EliesBets.`,
  };
}

type LeagueGroup = { leagueKey: string; leagueName: string; games: GameData[] };

function groupGamesByLeague(games: GameData[]): LeagueGroup[] {
  const map = new Map<string, LeagueGroup>();
  for (const game of games) {
    const leagueKey = game.league.slug;
    const leagueName = game.league.name;
    let group = map.get(leagueKey);
    if (!group) {
      group = { leagueKey, leagueName, games: [] };
      map.set(leagueKey, group);
    }
    group.games.push(game);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  for (const g of groups) {
    g.games.sort((a, b) => +a.startsAt - +b.startsAt);
  }
  return groups;
}

export default async function SportPage({ params }: Props) {
  const { chain, slug } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  const title = titleFromSlug(slug);

  return (
    <div className="page-shell">
      <h1 className="type-display">{title}</h1>
      <p className="type-muted mt-1">Sport: {slug}</p>
      <Suspense
        fallback={
          <div className="mt-8">
            <GameCardListSkeleton count={8} />
          </div>
        }
      >
        <SportGamesList chain={chain} slug={slug} />
      </Suspense>
    </div>
  );
}

async function SportGamesList({
  chain,
  slug,
}: {
  chain: ChainSlug;
  slug: string;
}) {
  const chainId = chainIdFromSlug(chain);
  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchGamesForSport(slug, chainId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[SportPage] fetchGamesForSport", e);
    }
    loadError = formatServerFetchError(e);
  }

  const oddsByGameId = loadError
    ? new Map<string, GameOddsData>()
    : await fetchTopOddsByGameId(games.map((g) => g.gameId), chainId);

  const byLeague = groupGamesByLeague(games);

  if (loadError) {
    return (
      <RetryCallout
        className="mt-6"
        title="Could not load games"
        description={loadError}
      />
    );
  }
  if (games.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6">
        <p className="text-sm font-medium text-zinc-200">No games</p>
        <p className="mt-1 text-sm text-zinc-500">
          No fixtures for this sport right now. Try another sport or check back when new
          events are added.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col gap-8">
      {byLeague.map((league) => (
        <section key={league.leagueKey} aria-labelledby={`league-${league.leagueKey}`}>
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <h2
              id={`league-${league.leagueKey}`}
              className="type-overline text-zinc-400"
            >
              {league.leagueName}
            </h2>
            {league.games[0] ? (
              <LeagueFavoriteButton
                sportSlug={slug}
                countrySlug={league.games[0].country.slug}
                leagueSlug={league.leagueKey}
                title={league.leagueName}
              />
            ) : null}
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {league.games.map((game) => (
              <li key={game.gameId}>
                <GameCard
                  game={game}
                  topOdds={oddsByGameId.get(game.gameId)?.topOdds ?? null}
                  overUnderOdds={oddsByGameId.get(game.gameId)?.overUnderOdds ?? null}
                  extraMarketsCount={Math.max(0, (oddsByGameId.get(game.gameId)?.marketCount ?? 0) - 1)}
                  oddsFetchedAt={oddsByGameId.get(game.gameId)?.fetchedAt}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
