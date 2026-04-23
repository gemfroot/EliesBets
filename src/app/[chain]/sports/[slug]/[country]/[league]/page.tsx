import { Suspense } from "react";
import type { GameData } from "@azuro-org/toolkit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard } from "@/components/GameCard";
import { fetchTopOddsByGameId, type GameOddsData } from "@/lib/oddsUtils";
import { RetryCallout } from "@/components/RetryCallout";
import { GameCardListSkeleton } from "@/components/Skeleton";
import { fetchGamesForLeague } from "@/lib/sportGames";
import { OddsRefreshControls } from "@/components/OddsRefreshControls";
import { formatServerFetchError } from "@/lib/serverFetchError";
import {
  chainIdFromSlug,
  isChainSlug,
  type ChainSlug,
} from "@/lib/sportsChainConstants";

export const revalidate = 20;

type Props = {
  params: Promise<{
    chain: string;
    slug: string;
    country: string;
    league: string;
  }>;
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function SportCountryLeaguePage({ params }: Props) {
  const { chain, slug, country: countrySlug, league: leagueSlug } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  const sportTitle = titleFromSlug(slug);
  const fallbackCountryName = titleFromSlug(countrySlug);
  const fallbackLeagueName = titleFromSlug(leagueSlug);

  return (
    <div className="page-shell">
      <p className="type-muted">
        <Link href={`/${chain}/sports/${slug}`} className="hover:text-zinc-300">
          {sportTitle}
        </Link>
        <span className="text-zinc-600"> · </span>
        <Link
          href={`/${chain}/sports/${slug}/${countrySlug}`}
          className="hover:text-zinc-300"
        >
          {fallbackCountryName}
        </Link>
        <span className="text-zinc-600"> · </span>
        <span className="text-zinc-400">{fallbackLeagueName}</span>
      </p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <h1 className="type-display">{fallbackLeagueName}</h1>
        <div className="flex items-center gap-2">
          <OddsRefreshControls className="" />
          <LeagueFavoriteButton
            sportSlug={slug}
            countrySlug={countrySlug}
            leagueSlug={leagueSlug}
            title={fallbackLeagueName}
          />
        </div>
      </div>
      <p className="type-muted mt-1">
        {sportTitle} · {fallbackCountryName}
      </p>
      <Suspense
        fallback={
          <div className="mt-8">
            <GameCardListSkeleton count={6} />
          </div>
        }
      >
        <LeagueGamesList
          chain={chain}
          slug={slug}
          countrySlug={countrySlug}
          leagueSlug={leagueSlug}
        />
      </Suspense>
    </div>
  );
}

async function LeagueGamesList({
  chain,
  slug,
  countrySlug,
  leagueSlug,
}: {
  chain: ChainSlug;
  slug: string;
  countrySlug: string;
  leagueSlug: string;
}) {
  const chainId = chainIdFromSlug(chain);
  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    const fetched = await fetchGamesForLeague(slug, leagueSlug, chainId);
    games = fetched.filter((g) => g.country.slug === countrySlug);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[SportCountryLeaguePage] fetchGamesForLeague", e);
    }
    loadError = formatServerFetchError(e);
  }

  const oddsByGameId = loadError
    ? new Map<string, GameOddsData>()
    : await fetchTopOddsByGameId(games.map((g) => g.gameId), chainId);

  games = [...games].sort((a, b) => +a.startsAt - +b.startsAt);

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
          This league has no upcoming fixtures. Try another league or check back later.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-8 flex flex-col gap-2">
      {games.map((game) => (
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
  );
}
