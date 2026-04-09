"use client";

import { useEffect, useState } from "react";
import type { Clock, ScoreBoard } from "@azuro-org/sdk";

const FOOTBALL_SLUGS = new Set(["football", "soccer", "futsal"]);

export function parseStartsAtMs(startsAt: string): number {
  const n = +startsAt;
  return n < 32_503_680_000 ? n * 1000 : n;
}

function isSoccerScoreBoard(
  board: ScoreBoard | null | undefined,
): board is Extract<ScoreBoard, { goals: unknown }> {
  return Boolean(board && "goals" in board && board.goals);
}

function isBasketballScoreBoard(
  board: ScoreBoard | null | undefined,
): board is Extract<ScoreBoard, { total: unknown }> {
  return Boolean(board && "total" in board && board.total);
}

/** Match minute for football from live clock or scoreboard (e.g. `45+2'`). */
export function formatFootballLiveMinute(
  scoreBoard: ScoreBoard | null | undefined,
  clock: Clock | null | undefined,
): string | null {
  const raw = clock?.clock_tm;
  const tm = raw != null ? String(raw).trim() : "";
  if (tm) {
    return /^\d+$/.test(tm) ? `${tm}'` : tm;
  }
  if (isSoccerScoreBoard(scoreBoard)) {
    const t = scoreBoard.time != null ? String(scoreBoard.time).trim() : "";
    if (!t) {
      return null;
    }
    if (/^\d+$/.test(t)) {
      return `${t}'`;
    }
    if (/^\d+\+\d+$/.test(t)) {
      return `${t}'`;
    }
    return t;
  }
  return null;
}

function formatElapsedSinceStart(startMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Primary timer line for the live badge: football uses match minute when available;
 * basketball uses provider clock string when present; otherwise elapsed since kickoff.
 */
export function formatLiveBadgeTimer(
  sportSlug: string,
  startsAt: string,
  scoreBoard: ScoreBoard | null | undefined,
  clock: Clock | null | undefined,
  nowMs: number,
): string {
  const startMs = parseStartsAtMs(startsAt);
  if (FOOTBALL_SLUGS.has(sportSlug)) {
    const minute = formatFootballLiveMinute(scoreBoard, clock);
    if (minute) {
      return minute;
    }
  }
  if (sportSlug === "basketball" && isBasketballScoreBoard(scoreBoard)) {
    const t = scoreBoard.time != null ? String(scoreBoard.time).trim() : "";
    if (t) {
      return t;
    }
  }
  return formatElapsedSinceStart(startMs, nowMs);
}

/** Short period / phase label from live scoreboard when the provider sends it. */
export function formatLivePeriodLabel(
  scoreBoard: ScoreBoard | null | undefined,
): string | null {
  const raw = scoreBoard?.state != null ? String(scoreBoard.state).trim() : "";
  if (!raw) {
    return null;
  }
  return raw.length > 32 ? `${raw.slice(0, 29)}…` : raw;
}

export type UseCountdownOptions = {
  /** When false, no timer runs (e.g. live games). */
  enabled?: boolean;
};

/**
 * Live-updating countdown to `targetMs`. For past targets, `label` is "Starting soon".
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
    const sync = () => {
      const t = Date.now();
      setNow(t);
      return t >= targetMs;
    };
    if (sync()) {
      return;
    }
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= targetMs) {
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetMs, enabled]);

  if (!enabled) {
    return { remainingMs: 0, label: "Starting soon", isPast: true };
  }

  const remainingMs = Number.isFinite(targetMs) ? targetMs - now : Number.NaN;
  const isPast = !Number.isFinite(targetMs) || remainingMs <= 0;
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
