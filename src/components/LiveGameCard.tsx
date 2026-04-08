"use client";

import { useActiveConditions } from "@azuro-org/sdk";
import type { GameData } from "@azuro-org/toolkit";
import { GameCard } from "@/components/GameCard";
import { extractMainLineOdds } from "@/lib/oddsUtils";
import { LiveBadge } from "@/components/LiveBadge";

const ODDS_REFETCH_MS = 4_000;

export function LiveGameCard({ game }: { game: GameData }) {
  const { data: conditions } = useActiveConditions({
    gameId: game.gameId,
    query: {
      refetchInterval: ODDS_REFETCH_MS,
    },
  });
  const topOdds = conditions ? extractMainLineOdds(conditions) : null;

  return (
    <GameCard
      game={game}
      topOdds={topOdds}
      meta={<LiveBadge startsAt={game.startsAt} />}
    />
  );
}
