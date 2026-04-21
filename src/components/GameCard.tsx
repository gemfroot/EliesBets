"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useActiveConditions } from "@azuro-org/sdk";
import { ConditionState, GameState, type GameData } from "@azuro-org/toolkit";
import { FavoriteGameButton } from "@/components/FavoriteButton";
import { OddsButton } from "@/components/OddsButton";
import { useBetslipActions } from "@/components/Betslip";
import {
  countGameMarkets,
  extractMainLineOdds,
  extractOverUnderOdds,
  type TopOddsLine,
} from "@/lib/oddsUtils";
import { useGlobalSeconds } from "@/lib/useGlobalSeconds";
import { useCountdown, parseStartsAtMs, formatStartTime } from "@/lib/useCountdown";
import { SportNavIcon } from "@/lib/sportNavIcon";
import { getOutcomeDisplayLabel } from "@/lib/outcomeLabels";
import { encodeSlipDecimalOdds } from "@/lib/oddsFormat";

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

function dedupeOuAgainstMain(
  ou: TopOddsLine[] | null | undefined,
  main: TopOddsLine[] | null | undefined,
): TopOddsLine[] | null {
  if (!ou?.length || !main?.length) {
    return ou ?? null;
  }
  if (ou[0]!.conditionId === main[0]!.conditionId) {
    return null;
  }
  return ou;
}

const LIST_ODDS_STALE_MS = 30_000;

export type GameCardProps = {
  game: GameData;
  topOdds?: TopOddsLine[] | null;
  /** Optional Over/Under line (shown below main line when distinct from it). */
  overUnderOdds?: TopOddsLine[] | null;
  /** Markets not represented by the main + O/U rows; "+N" links to game detail. */
  extraMarketsCount?: number;
  /** When list fetch is older than ~30s, odds stay disabled until the user hovers/taps and we refetch via `useActiveConditions`. */
  oddsFetchedAt?: number | null;
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
  oddsFetchedAt = null,
}: GameCardProps) {
  const now = useGlobalSeconds();
  const { addSelection } = useBetslipActions();
  const names = participantLine(game);
  const when = formatStartTime(game.startsAt);
  const { participants } = game;
  const gameHref = `/games/${game.gameId}`;

  const isStale =
    typeof oddsFetchedAt === "number" &&
    Number.isFinite(oddsFetchedAt) &&
    now - oddsFetchedAt > LIST_ODDS_STALE_MS;
  const [staleRefreshRequested, setStaleRefreshRequested] = useState(false);
  const shouldRefetchStaleList = isStale && staleRefreshRequested;

  const { data: listRefreshConditions, isFetching: listOddsRefreshing } =
    useActiveConditions({
      gameId: game.gameId,
      query: {
        enabled: shouldRefetchStaleList,
        staleTime: 0,
      },
    });

  const refreshedTop =
    listRefreshConditions != null
      ? extractMainLineOdds(listRefreshConditions)
      : null;
  const refreshedOuRaw =
    listRefreshConditions != null
      ? extractOverUnderOdds(listRefreshConditions)
      : null;
  const refreshedOu = dedupeOuAgainstMain(refreshedOuRaw, refreshedTop);

  const topForUi = refreshedTop ?? topOdds ?? null;
  const ouForUi = (refreshedOu ?? overUnderOdds) ?? null;

  const totalMarketsAfterRefresh =
    listRefreshConditions != null
      ? countGameMarkets(listRefreshConditions)
      : null;
  const marketsShownCount =
    (topForUi?.length ? 1 : 0) + (ouForUi?.length ? 1 : 0);
  const extraMarketsForUi =
    totalMarketsAfterRefresh != null
      ? Math.max(0, totalMarketsAfterRefresh - marketsShownCount)
      : extraMarketsCount;

  const showListOddsSkeleton =
    shouldRefetchStaleList && listOddsRefreshing && refreshedTop == null;
  const listOddsRefreshFailed =
    isStale &&
    staleRefreshRequested &&
    !listOddsRefreshing &&
    refreshedTop == null;
  const needsStaleListInteraction =
    isStale && refreshedTop == null && !showListOddsSkeleton;

  const outcomeCtx = {
    sportSlug: game.sport.slug,
    participants: game.participants,
  };

  const addLine = (line: TopOddsLine) => {
    const displayLabel = getOutcomeDisplayLabel(line.label, outcomeCtx);
    addSelection({
      gameId: game.gameId,
      gameTitle: names,
      outcomeName: displayLabel,
      odds:
        Number.isFinite(line.odds) && line.odds > 0
          ? encodeSlipDecimalOdds(line.odds)
          : "—",
      outcomeId: line.outcomeId,
      conditionId: line.conditionId,
      isExpressForbidden: line.isExpressForbidden,
      listConditionStateAtAdd: line.conditionState,
    });
  };

  const lineDisabled = (line: TopOddsLine) =>
    line.conditionState !== ConditionState.Active || needsStaleListInteraction;

  const staleHint = needsStaleListInteraction ? (
    <p className="text-[10px] leading-snug text-amber-500/85">
      List prices may be stale — hover or tap this card to refresh.
    </p>
  ) : listOddsRefreshFailed ? (
    <p className="text-[10px] leading-snug text-red-400/90">
      Could not refresh odds.{" "}
      <Link href={gameHref} className="underline hover:text-red-300">
        Open game
      </Link>
    </p>
  ) : null;

  const onStaleListPointerEnter = () => {
    if (isStale && !staleRefreshRequested) {
      setStaleRefreshRequested(true);
    }
  };

  const hasMain = topForUi && topForUi.length > 0;
  const hasOu = ouForUi && ouForUi.length > 0;

  const oddsBlock =
    hasMain || hasOu ? (
      variant === "heroLive" ? (
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          {staleHint}
          {showListOddsSkeleton ? (
            <div className="flex w-full min-w-0 flex-col gap-1" aria-busy="true">
              <p className="text-[10px] text-amber-500/90">Refreshing odds…</p>
              <div className="flex w-full min-w-0 flex-row gap-1.5" aria-label="Odds">
                <div className="h-10 min-w-0 flex-1 animate-pulse rounded-md bg-zinc-800/80" />
                <div className="h-10 min-w-0 flex-1 animate-pulse rounded-md bg-zinc-800/80" />
              </div>
            </div>
          ) : (
            <div className="flex w-full min-w-0 flex-row gap-1.5" aria-label="Odds">
              {hasMain
                ? topForUi!.map((line) => {
                    const displayLabel = getOutcomeDisplayLabel(
                      line.label,
                      outcomeCtx,
                    );
                    return (
                      <OddsButton
                        key={line.outcomeId}
                        gameId={game.gameId}
                        outcomeName={displayLabel}
                        outcomeId={line.outcomeId}
                        odds={line.odds}
                        disabled={lineDisabled(line)}
                        label={displayLabel}
                        className="min-h-10 min-w-0 flex-1 py-1.5"
                        onClick={() => addLine(line)}
                      />
                    );
                  })
                : null}
              {hasMain && hasOu ? (
                <div className="w-px shrink-0 self-stretch bg-zinc-700/60" />
              ) : null}
              {hasOu
                ? ouForUi!.map((line) => {
                    const displayLabel = getOutcomeDisplayLabel(
                      line.label,
                      outcomeCtx,
                    );
                    return (
                      <OddsButton
                        key={line.outcomeId}
                        gameId={game.gameId}
                        outcomeName={displayLabel}
                        outcomeId={line.outcomeId}
                        odds={line.odds}
                        disabled={lineDisabled(line)}
                        label={displayLabel}
                        className="min-h-10 min-w-0 flex-1 py-1.5"
                        onClick={() => addLine(line)}
                      />
                    );
                  })
                : null}
            </div>
          )}
          {extraMarketsForUi > 0 ? (
            <Link
              href={gameHref}
              className="self-end text-[11px] font-medium tabular-nums text-zinc-500 transition-colors hover:text-zinc-300"
            >
              +{extraMarketsForUi} markets
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full min-w-0 shrink flex-col gap-1.5 md:w-auto md:max-w-[min(100%,26rem)] md:items-end">
          {staleHint}
          {showListOddsSkeleton ? (
            <div className="flex w-full min-w-0 flex-col gap-1" aria-busy="true">
              <p className="text-[10px] text-amber-500/90">Refreshing odds…</p>
              <div className="flex w-full min-w-0 flex-row items-stretch gap-1.5">
                <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-zinc-800/80 md:min-h-0" />
                <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-zinc-800/80 md:min-h-0" />
              </div>
            </div>
          ) : (
            <div className="flex w-full min-w-0 flex-row items-stretch gap-1.5">
              {hasMain
                ? topForUi!.map((line) => {
                    const displayLabel = getOutcomeDisplayLabel(
                      line.label,
                      outcomeCtx,
                    );
                    return (
                      <OddsButton
                        key={line.outcomeId}
                        gameId={game.gameId}
                        outcomeName={displayLabel}
                        outcomeId={line.outcomeId}
                        odds={line.odds}
                        disabled={lineDisabled(line)}
                        label={displayLabel}
                        className="min-h-11 min-w-0 flex-1 py-2 md:min-h-0 md:py-1.5"
                        onClick={() => addLine(line)}
                      />
                    );
                  })
                : null}
              {hasMain && hasOu ? (
                <div className="hidden w-px shrink-0 self-stretch bg-zinc-700/60 md:block" />
              ) : null}
              {hasOu
                ? ouForUi!.map((line) => {
                    const displayLabel = getOutcomeDisplayLabel(
                      line.label,
                      outcomeCtx,
                    );
                    return (
                      <OddsButton
                        key={line.outcomeId}
                        gameId={game.gameId}
                        outcomeName={displayLabel}
                        outcomeId={line.outcomeId}
                        odds={line.odds}
                        disabled={lineDisabled(line)}
                        label={displayLabel}
                        className="min-h-11 min-w-0 flex-1 py-2 md:min-h-0 md:py-1.5"
                        onClick={() => addLine(line)}
                      />
                    );
                  })
                : null}
              {extraMarketsForUi > 0 ? (
                <Link
                  href={gameHref}
                  className="inline-flex min-h-11 min-w-[2.75rem] shrink-0 items-center justify-center self-stretch rounded-md border border-zinc-700 bg-zinc-800/80 px-2 text-xs font-semibold tabular-nums text-zinc-300 transition-colors hover:bg-zinc-700/90 md:min-h-0"
                  aria-label={`${extraMarketsForUi} more markets`}
                >
                  +{extraMarketsForUi}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      )
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
      <article
        className="flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
        onPointerEnter={onStaleListPointerEnter}
      >
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <SportNavIcon slug={game.sport.slug} className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate text-[11px] text-zinc-500">
            {game.sport.name} · {game.league.name}
          </span>
        </div>
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
    <article
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      onPointerEnter={onStaleListPointerEnter}
    >
      {variant === "default" && (
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <SportNavIcon slug={game.sport.slug} className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate text-[11px] text-zinc-500">
            {game.sport.name} · {game.league.name}
          </span>
        </div>
      )}
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
