"use client";

import { useLiveStatistics } from "@azuro-org/sdk";
import { GameState } from "@azuro-org/toolkit";
import { LiveBadge } from "@/components/LiveBadge";
import { formatLiveScoreBoard, parseStartsAtMs, useCountdown } from "@/lib/useCountdown";

function formatStartTime(startsAt: string): string {
  const ms = parseStartsAtMs(startsAt);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function GameDetailStatus({
  gameId,
  sportId,
  sportSlug,
  state,
  startsAt,
}: {
  gameId: string;
  sportId: string;
  sportSlug: string;
  state: GameState;
  startsAt: string;
}) {
  const when = formatStartTime(startsAt);
  const { label: countdownLabel } = useCountdown(parseStartsAtMs(startsAt), {
    enabled: state === GameState.Prematch,
  });
  const { data: liveStats } = useLiveStatistics({
    gameId,
    sportId,
    gameState: state,
    enabled: state === GameState.Live,
  });
  const scoreLine = formatLiveScoreBoard(liveStats?.scoreBoard);

  if (state === GameState.Prematch) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-4">
        <p className="type-display text-2xl tabular-nums sm:text-3xl" aria-live="polite">
          Starts in {countdownLabel}
        </p>
        <p className="type-caption mt-2 font-mono tabular-nums text-zinc-500">{when}</p>
      </div>
    );
  }

  if (state === GameState.Live) {
    return (
      <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LiveBadge
            startsAt={startsAt}
            sportSlug={sportSlug}
            scoreBoard={liveStats?.scoreBoard}
            clock={liveStats?.clock}
          />
          {scoreLine ? (
            <span
              className="type-display text-2xl tabular-nums text-zinc-50 sm:text-3xl"
              aria-live="polite"
            >
              {scoreLine}
            </span>
          ) : null}
        </div>
        <p className="type-caption mt-2 font-mono tabular-nums text-zinc-500">{when}</p>
      </div>
    );
  }

  return (
    <p className="type-caption mt-4 font-mono tabular-nums text-zinc-500">{when}</p>
  );
}
