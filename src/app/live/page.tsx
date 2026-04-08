import {
  GameOrderBy,
  GameState,
  OrderDirection,
  getGamesByFilters,
  type GameData,
} from "@azuro-org/toolkit";
import { LiveGamesList } from "@/components/LiveGamesList";

export const dynamic = "force-dynamic";

const CHAIN_ID = 137 as const;
const GAMES_PER_PAGE = 100;

async function fetchAllLiveGames(): Promise<GameData[]> {
  const collected: GameData[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await getGamesByFilters({
      chainId: CHAIN_ID,
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
  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    games = await fetchAllLiveGames();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load live games.";
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
