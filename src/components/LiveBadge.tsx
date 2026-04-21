"use client";

import type { Clock, ScoreBoard } from "@azuro-org/sdk";
import { useMemo } from "react";
import {
  formatLiveBadgeTimer,
  formatLivePeriodLabel,
} from "@/lib/useCountdown";
import { useGlobalSeconds } from "@/lib/useGlobalSeconds";

export function LiveBadge({
  startsAt,
  sportSlug,
  scoreBoard,
  clock,
}: {
  startsAt: string;
  sportSlug: string;
  scoreBoard?: ScoreBoard | null;
  clock?: Clock | null;
}) {
  const now = useGlobalSeconds();

  const timer = useMemo(
    () =>
      formatLiveBadgeTimer(sportSlug, startsAt, scoreBoard ?? null, clock ?? null, now),
    [sportSlug, startsAt, scoreBoard, clock, now],
  );

  const period = formatLivePeriodLabel(scoreBoard ?? null);

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium tabular-nums text-red-400">
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
          aria-hidden
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="min-w-0">
        LIVE · {timer}
        {period ? (
          <>
            {" "}
            <span className="text-zinc-500">· {period}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}
