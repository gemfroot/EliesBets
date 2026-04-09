"use client";

import { useEffect, useState } from "react";
import type { ScoreBoard } from "@azuro-org/sdk";

export function parseStartsAtMs(startsAt: string): number {
  const n = +startsAt;
  return n < 32_503_680_000 ? n * 1000 : n;
}

export type UseCountdownOptions = {
  /** When false, no timer runs (e.g. live or finished games that do not show a countdown). */
  enabled?: boolean;
};

/**
 * Live-updating countdown to `targetMs`. For past targets, `label` is "Starting soon".
 * Invalid `targetMs` yields a safe label (no NaN). The interval stops when the countdown hits zero.
 */
export function useCountdown(
  targetMs: number,
  options?: UseCountdownOptions,
): { remainingMs: number; label: string; isPast: boolean } {
  const enabled = options?.enabled !== false;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !Number.isFinite(targetMs)) {
      return;
    }

    if (targetMs - Date.now() <= 0) {
      setNow(Date.now());
      return;
    }

    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (targetMs - t <= 0) {
        window.clearInterval(id);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [targetMs, enabled]);

  if (!Number.isFinite(targetMs)) {
    return { remainingMs: 0, label: "Starting soon", isPast: true };
  }

  if (!enabled) {
    return { remainingMs: 0, label: "Starting soon", isPast: true };
  }

  const remainingMs = targetMs - now;
  const isPast = remainingMs <= 0;
  if (isPast) {
    return { remainingMs: 0, label: "Starting soon", isPast: true };
  }

  const sec = Math.floor(remainingMs / 1000);
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  let label: string;
  if (d > 0) {
    label = `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else if (h > 0) {
    label = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    label = `${m}:${String(s).padStart(2, "0")}`;
  }

  return { remainingMs, label, isPast: false };
}

/** Compact score line from Azuro live statistics `scoreBoard`, when present. */
export function formatLiveScoreBoard(board: ScoreBoard | null | undefined): string | null {
  if (!board) {
    return null;
  }
  if ("goals" in board && board.goals) {
    return `${board.goals.h}–${board.goals.g}`;
  }
  if ("total" in board && board.total) {
    return `${board.total.h}–${board.total.g}`;
  }
  if ("sets" in board && board.sets) {
    return `${board.sets.h}–${board.sets.g}`;
  }
  return null;
}
