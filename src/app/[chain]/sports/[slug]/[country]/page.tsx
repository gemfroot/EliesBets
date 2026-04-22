import { Suspense } from "react";
import type { GameData } from "@azuro-org/toolkit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard } from "@/components/GameCard";
import { fetchTopOddsByGameId, type GameOddsData } from "@/lib/oddsUtils";
import { RetryCallout } from "@/components/RetryCallout";
import { GameCardListSkeleton } from "@/components/Skeleton";
import { fetchGamesForSportCountry } from "@/lib/sportGames";
import { formatServerFetchError } from "@/lib/serverFetchError";
import {
  chainIdFromSlug,
  isChainSlug,
  type ChainSlug,
} from "@/lib/sportsChainConstants";

export const revalidate = 45;

type Props = {
  params: Promise<{ chain: string; slug: string; country: string }>;
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

export default async function SportCountryPage({ params }: Props) {
  const { chain, slug, country: countrySlug } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  const sportTitle = titleFromSlug(slug);
  const fallbackCountryName = titleFromSlug(countrySlug);

  return (
    <div className="page-shell">
      <p className="type-muted">
        <Link href={`/${chain}/sports/${slug}`} className="hover:text-zinc-300">
          {sportTitle}
        </Link>
        <span className="text-zinc-600"> · </span>
        <span className="text-zinc-400">{fallbackCountryName}</span>
      </p>
      <h1 className="type-display mt-2">{fallbackCountryName}</h1>
      <p className="type-muted mt-1">
        {sportTitle} · {countrySlug}
      </p>
      <Suspense
        fallback={
          <div className="mt-8">
            <GameCardListSkeleton count={6} />
          </div>
        }
      >
        <SportCountryGamesList
          chain={chain}
          slug={slug}
          countrySlug={countrySlug}
        />
      </Suspense>
    </div>
  );
}

async function SportCountryGamesList({
  chain,
  slug,
  countrySlug,
}: {
  chain: ChainSlug;
  slug: string;
  countrySlug: string;
}) {
  const chainId = chainIdFromSlug(chain);
  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchGamesForSportCountry(slug, countrySlug, chainId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[SportCountryPage] fetchGamesForSportCountry", e);
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
          No fixtures for this country yet. Pick a different region or browse other
          leagues.
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
              <Link
                href={`/${chain}/sports/${slug}/${countrySlug}/${league.leagueKey}`}
                className="hover:text-zinc-200"
              >
                {league.leagueName}
              </Link>
            </h2>
            <LeagueFavoriteButton
              sportSlug={slug}
              countrySlug={countrySlug}
              leagueSlug={league.leagueKey}
              title={league.leagueName}
            />
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
