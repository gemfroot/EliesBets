import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  type GameData,
} from "@azuro-org/toolkit";
import { LiveGamesList } from "@/components/LiveGamesList";
import { formatServerFetchError } from "@/lib/serverFetchError";
import { getSportsChainId } from "@/lib/sportsChain";
import type { SportsChainId } from "@/lib/sportsChainConstants";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live games",
  description:
    "In-play sports fixtures with updating odds. Follow live markets and bet with your wallet on EliesBets.",
};

const GAMES_PER_PAGE = 100;

async function fetchAllLiveGames(chainId: SportsChainId): Promise<GameData[]> {
  const collected: GameData[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await getGamesByFilters({
      chainId,
      state: GameState.Live,
      orderBy: GameOrderBy.StartsAt,
      orderDir: OrderDirection.Asc,
      page,
      perPage: GAMES_PER_PAGE,
    });
    collected.push(...res.games);
    totalPages = res.totalPages;
    page += 1;
  }
  return collected;
}

export default async function LivePage() {
  const chainId = await getSportsChainId();
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
