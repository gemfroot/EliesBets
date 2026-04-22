import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  type GameData,
} from "@azuro-org/toolkit";
import { LiveGamesList } from "@/components/LiveGamesList";
import { formatServerFetchError } from "@/lib/serverFetchError";
import {
  chainIdFromSlug,
  isChainSlug,
  type SportsChainId,
} from "@/lib/sportsChainConstants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live games",
  description:
    "In-play sports fixtures with updating odds. Follow live markets and bet with your wallet on EliesBets.",
};

export const revalidate = 15;

const GAMES_PER_PAGE = 100;

const fetchAllLiveGames = unstable_cache(
  async (chainId: SportsChainId): Promise<GameData[]> => {
    const baseParams = {
      chainId,
      state: GameState.Live,
      orderBy: GameOrderBy.StartsAt,
      orderDir: OrderDirection.Asc,
      perPage: GAMES_PER_PAGE,
    } as const;
    const first = await getGamesByFilters({ ...baseParams, page: 1 });
    if (first.totalPages <= 1) {
      return first.games;
    }
    const remainingPages = Array.from(
      { length: first.totalPages - 1 },
      (_, i) => i + 2,
    );
    const rest = await Promise.all(
      remainingPages.map((page) => getGamesByFilters({ ...baseParams, page })),
    );
    return [...first.games, ...rest.flatMap((r) => r.games)];
  },
  ["fetchAllLiveGames"],
  { revalidate: 15 },
);

type Props = {
  params: Promise<{ chain: string }>;
};

export default async function LivePage({ params }: Props) {
  const { chain } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  const chainId = chainIdFromSlug(chain);
  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchAllLiveGames(chainId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[LivePage] fetchAllLiveGames", e);
    }
    loadError = formatServerFetchError(e);
  }

  return (
    <div className="page-shell">
      <h1 className="type-display">Live games</h1>
      <p className="type-muted mt-1">
        In-play fixtures with updating odds.
      </p>
      <LiveGamesList games={games} loadError={loadError} />
    </div>
  );
}
