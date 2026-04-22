"use client";

import type { Clock, ScoreBoard } from "@azuro-org/sdk";
import { useGlobalSeconds } from "@/lib/useGlobalSeconds";

const FOOTBALL_SLUGS = new Set(["football", "soccer", "futsal"]);

export function parseStartsAtMs(startsAt: string): number {
  const n = +startsAt;
  return n < 32_503_680_000 ? n * 1000 : n;
}

/** Shared start-time label for cards and bet history (seconds vs ms heuristic). */
export function formatStartTime(
  startsAt: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const ms = parseStartsAtMs(startsAt);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(new Date(ms));
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

/** Match minute is never a Unix epoch; providers sometimes mis-send ms in `clock_tm`. */
function isPlausibleFootballMinuteToken(s: string): boolean {
  const t = s.trim();
  if (!/^\d+$/.test(t)) {
    return true;
  }
  const n = Number(t);
  return n >= 0 && n <= 300;
}

/** Reject clock strings that are Unix ms / epoch garbage (any all-digit token > 10_000). */
export function isSuspiciousLiveClockToken(s: string): boolean {
  const t = s.trim();
  if (!/^\d+$/.test(t)) {
    return false;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 10_000;
}

/** True when an all-digit token is kickoff time in ms (feed sometimes puts `startsAt` into `clock_tm`). */
export function isKickoffMsClockToken(token: string, startsAt: string): boolean {
  const t = token.trim();
  if (!/^\d+$/.test(t)) {
    return false;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return false;
  const startMs = parseStartsAtMs(startsAt);
  return Math.abs(n - startMs) < 120_000;
}

/** Match minute for football from live clock or scoreboard (e.g. `45+2'`). */
export function formatFootballLiveMinute(
  scoreBoard: ScoreBoard | null | undefined,
  clock: Clock | null | undefined,
): string | null {
  const raw = clock?.clock_tm;
  const tm = raw != null ? String(raw).trim() : "";
  if (tm) {
    if (!/^\d+$/.test(tm) || isPlausibleFootballMinuteToken(tm)) {
      return /^\d+$/.test(tm) ? `${tm}'` : tm;
    }
  }
  if (isSoccerScoreBoard(scoreBoard)) {
    const t = scoreBoard.time != null ? String(scoreBoard.time).trim() : "";
    if (!t) {
      return null;
    }
    if (/^\d+$/.test(t) && !isPlausibleFootballMinuteToken(t)) {
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
  const rawClock = clock?.clock_tm != null ? String(clock.clock_tm).trim() : "";
  if (rawClock) {
    if (
      !isSuspiciousLiveClockToken(rawClock) &&
      !isKickoffMsClockToken(rawClock, startsAt)
    ) {
      return /^\d+$/.test(rawClock) ? `${rawClock}'` : rawClock;
    }
  }
  if (sportSlug === "basketball" && isBasketballScoreBoard(scoreBoard)) {
    const t = scoreBoard.time != null ? String(scoreBoard.time).trim() : "";
    if (
      t &&
      !isSuspiciousLiveClockToken(t) &&
      !isKickoffMsClockToken(t, startsAt)
    ) {
      return t;
    }
  }
  if (isSoccerScoreBoard(scoreBoard)) {
    const t = scoreBoard.time != null ? String(scoreBoard.time).trim() : "";
    if (
      t &&
      !isSuspiciousLiveClockToken(t) &&
      !isKickoffMsClockToken(t, startsAt) &&
      !/^\d+$/.test(t)
    ) {
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
  const now = useGlobalSeconds();

  if (!enabled) {
    return { remainingMs: 0, label: "Starting soon", isPast: true };
  }

  // `useGlobalSeconds` returns `0` during SSR + the first client render so
  // hydration stays byte-identical. Treat that as "clock not ready" and emit
  // a stable placeholder — computing `targetMs - 0` would render absurd
  // "20013d" labels for a fraction of a second before the real tick lands.
  if (!now) {
    return { remainingMs: 0, label: "—", isPast: false };
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
