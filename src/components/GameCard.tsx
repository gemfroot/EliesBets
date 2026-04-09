"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GameState, type GameData } from "@azuro-org/toolkit";
import { FavoriteGameButton } from "@/components/FavoriteButton";
import { OddsButton } from "@/components/OddsButton";
import { useBetslipActions } from "@/components/Betslip";
import type { TopOddsLine } from "@/lib/oddsUtils";
import { useCountdown, parseStartsAtMs } from "@/lib/useCountdown";

function formatStartTime(startsAt: string): string {
  const ms = +startsAt < 32_503_680_000 ? +startsAt * 1000 : +startsAt;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function PrematchCountdown({
  startsAt,
  variant,
}: {
  startsAt: string;
  variant: "default" | "heroLive";
}) {
  const { label } = useCountdown(parseStartsAtMs(startsAt));
  const className =
    variant === "heroLive"
      ? "text-xs tabular-nums text-zinc-400"
      : "mt-1 text-xs tabular-nums text-zinc-400";
  return (
    <p className={className} aria-live="polite">
      Starts in {label}
    </p>
  );
}

function participantLine(game: GameData): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}

export type GameCardProps = {
  game: GameData;
  topOdds?: TopOddsLine[] | null;
  /** Optional Over/Under line (shown below main line when distinct from it). */
  overUnderOdds?: TopOddsLine[] | null;
  /** Markets not represented by the main + O/U rows; "+N" links to game detail. */
  extraMarketsCount?: number;
  /** When set, replaces the default formatted start time under the title. */
  meta?: ReactNode;
  /** Stacked layout for home hero live grid: names → meta → odds, no side-by-side clash. */
  variant?: "default" | "heroLive";
};

export function GameCard({
  game,
  topOdds,
  overUnderOdds,
  extraMarketsCount = 0,
  meta,
  variant = "default",
}: GameCardProps) {
  const { addSelection } = useBetslipActions();
  const names = participantLine(game);
  const when = formatStartTime(game.startsAt);
  const { participants } = game;
  const gameHref = `/games/${game.gameId}`;

  const mainButtonClass =
    variant === "heroLive"
      ? "min-h-10 min-w-0 flex-1 py-2 text-left"
      : "min-h-11 w-full flex-none py-2 text-left md:min-h-0 md:w-auto md:flex-none md:py-1.5";

  const ouButtonClass =
    variant === "heroLive"
      ? "min-h-10 min-w-0 flex-1 py-2 text-left"
      : "min-h-11 w-full flex-none py-2 text-left md:min-h-0 md:w-auto md:flex-none md:py-1.5";

  const addLine = (line: TopOddsLine) =>
    addSelection({
      gameId: game.gameId,
      gameTitle: names,
      outcomeName: line.label,
      odds:
        Number.isFinite(line.odds) && line.odds > 0
          ? line.odds.toFixed(2)
          : "—",
      outcomeId: line.outcomeId,
      conditionId: line.conditionId,
      isExpressForbidden: line.isExpressForbidden,
    });

  const extraBadgeRow = (onOuRow: boolean) =>
    extraMarketsCount > 0 &&
    (onOuRow ? !!overUnderOdds?.length : !overUnderOdds?.length) ? (
      <Link
        href={gameHref}
        className={
          variant === "heroLive"
            ? "inline-flex min-h-10 min-w-[2.75rem] shrink-0 items-center justify-center self-stretch rounded-md border border-zinc-700 bg-zinc-800/80 px-2 text-xs font-semibold tabular-nums text-zinc-300 transition-colors hover:bg-zinc-700/90"
            : "inline-flex min-h-11 min-w-[2.75rem] shrink-0 items-center justify-center self-stretch rounded-md border border-zinc-700 bg-zinc-800/80 px-2 text-xs font-semibold tabular-nums text-zinc-300 transition-colors hover:bg-zinc-700/90 md:min-h-0"
        }
        aria-label={`${extraMarketsCount} more markets`}
      >
        +{extraMarketsCount}
      </Link>
    ) : null;

  const mainOddsRow =
    topOdds && topOdds.length > 0 ? (
      <div
        className={
          variant === "heroLive"
            ? "flex w-full min-w-0 flex-row items-stretch gap-2"
            : "flex w-full min-w-0 shrink flex-row items-stretch gap-2 md:w-auto md:max-w-[min(100%,22rem)]"
        }
        aria-label="Main odds"
      >
        <div
          className={
            variant === "heroLive"
              ? "flex min-w-0 flex-1 flex-row gap-2"
              : "flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:gap-2"
          }
        >
          {topOdds.map((line) => (
            <OddsButton
              key={line.outcomeId}
              gameId={game.gameId}
              outcomeName={line.label}
              outcomeId={line.outcomeId}
              odds={line.odds}
              label={line.label}
              className={mainButtonClass}
              onClick={() => addLine(line)}
            />
          ))}
        </div>
        {extraBadgeRow(false)}
      </div>
    ) : null;

  const overUnderRow =
    overUnderOdds && overUnderOdds.length > 0 ? (
      <div
        className={
          variant === "heroLive"
            ? "flex w-full min-w-0 flex-row items-stretch gap-2"
            : "flex w-full min-w-0 shrink flex-row items-stretch gap-2 md:w-auto md:max-w-[min(100%,22rem)]"
        }
        aria-label="Over/Under odds"
      >
        <div
          className={
            variant === "heroLive"
              ? "flex min-w-0 flex-1 flex-row gap-2"
              : "flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:gap-2"
          }
        >
          {overUnderOdds.map((line) => (
            <OddsButton
              key={line.outcomeId}
              gameId={game.gameId}
              outcomeName={line.label}
              outcomeId={line.outcomeId}
              odds={line.odds}
              label={line.label}
              className={ouButtonClass}
              onClick={() => addLine(line)}
            />
          ))}
        </div>
        {extraBadgeRow(true)}
      </div>
    ) : null;

  const oddsBlock =
    mainOddsRow || overUnderRow ? (
      <div
        className={
          variant === "heroLive"
            ? "flex w-full min-w-0 flex-col gap-2"
            : "flex w-full min-w-0 shrink flex-col gap-2 md:w-auto md:max-w-[min(100%,22rem)] md:items-end"
        }
      >
        {mainOddsRow}
        {overUnderRow}
      </div>
    ) : (
      <p
        className={
          variant === "heroLive"
            ? "text-center text-xs text-zinc-600"
            : "shrink-0 text-xs text-zinc-600"
        }
      >
        Odds unavailable
      </p>
    );

  if (variant === "heroLive") {
    const titleBlock =
      participants.length >= 2 ? (
        <h2 className="min-w-0 flex-1 text-sm font-medium">
          <Link
            href={gameHref}
            className="group block text-left text-zinc-100"
          >
            <span className="block truncate group-hover:text-zinc-50 group-hover:underline">
              {participants[0]!.name}
            </span>
            <span className="mt-1 block text-center text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              vs
            </span>
            <span className="mt-1 block truncate group-hover:text-zinc-50 group-hover:underline">
              {participants[1]!.name}
            </span>
          </Link>
        </h2>
      ) : (
        <h2 className="min-w-0 flex-1 text-sm font-medium text-zinc-100">
          <Link
            href={gameHref}
            className="block truncate hover:text-zinc-50 hover:underline"
          >
            {names}
          </Link>
        </h2>
      );

    return (
      <article className="flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          {titleBlock}
          <FavoriteGameButton gameId={game.gameId} title={names} />
        </div>
        <div className="flex min-h-[1.75rem] shrink-0 items-center justify-center py-1">
          {meta ??
            (game.state === GameState.Prematch ? (
              <PrematchCountdown startsAt={game.startsAt} variant="heroLive" />
            ) : (
              <p className="text-xs tabular-nums text-zinc-500">{when}</p>
            ))}
        </div>
        <div className="mt-auto min-w-0 pt-1">{oddsBlock}</div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-1">
            <h2 className="min-w-0 flex-1 text-sm font-medium text-zinc-100">
              <Link
                href={`/games/${game.gameId}`}
                className="block min-w-0 truncate hover:text-zinc-50 hover:underline"
              >
                {names}
              </Link>
            </h2>
            <FavoriteGameButton gameId={game.gameId} title={names} />
          </div>
          {meta ??
            (game.state === GameState.Prematch ? (
              <PrematchCountdown startsAt={game.startsAt} variant="default" />
            ) : (
              <p className="mt-1 text-xs tabular-nums text-zinc-500">{when}</p>
            ))}
        </div>
        {oddsBlock}
      </div>
    </article>
  );
}
