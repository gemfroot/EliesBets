"use client";

import { useActiveConditions, useLiveStatistics } from "@azuro-org/sdk";
import { GameState, type GameData } from "@azuro-org/toolkit";
import { GameCard } from "@/components/GameCard";
import {
  countGameMarkets,
  extractMainLineOdds,
  extractOverUnderOdds,
} from "@/lib/oddsUtils";
import { LiveBadge } from "@/components/LiveBadge";
import { formatLiveScoreBoard } from "@/lib/useCountdown";

const ODDS_REFETCH_MS = 4_000;

export function LiveGameCard({
  game,
  variant = "default",
}: {
  game: GameData;
  variant?: "default" | "heroLive";
}) {
  const { data: conditions } = useActiveConditions({
    gameId: game.gameId,
    query: {
      refetchInterval: ODDS_REFETCH_MS,
    },
  });
  const { data: liveStats } = useLiveStatistics({
    gameId: game.gameId,
    sportId: game.sport.sportId,
    gameState: game.state,
    enabled: game.state === GameState.Live,
  });
  const topOdds = conditions ? extractMainLineOdds(conditions) : null;
  const ouRaw = conditions ? extractOverUnderOdds(conditions) : null;
  const overUnderOdds =
    ouRaw?.length &&
    topOdds?.length &&
    ouRaw[0]!.conditionId === topOdds[0]!.conditionId
      ? null
      : ouRaw;
  const totalMarkets = conditions ? countGameMarkets(conditions) : 0;
  const marketsShown =
    (topOdds?.length ? 1 : 0) + (overUnderOdds?.length ? 1 : 0);
  const extraMarketsCount = Math.max(0, totalMarkets - marketsShown);
  const scoreLine = formatLiveScoreBoard(liveStats?.scoreBoard);

  const meta = (
    <div
      className={
        variant === "heroLive"
          ? "flex flex-col items-center gap-0.5"
          : "flex flex-col items-start gap-0.5"
      }
    >
      <LiveBadge startsAt={game.startsAt} />
      {scoreLine ? (
        <span
          className="text-xs font-semibold tabular-nums text-zinc-100"
          aria-live="polite"
        >
          {scoreLine}
        </span>
      ) : null}
    </div>
  );

  return (
    <GameCard
      game={game}
      topOdds={topOdds}
      overUnderOdds={overUnderOdds}
      extraMarketsCount={extraMarketsCount}
      meta={meta}
      variant={variant}
    />
  );
}
