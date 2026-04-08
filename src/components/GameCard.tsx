"use client";

import {
  groupConditionsByMarket,
  type ConditionDetailedData,
  type GameData,
} from "@azuro-org/toolkit";
import { useBetslip } from "@/components/Betslip";

export type TopOddsLine = { label: string; odds: string };

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

/**
 * Picks Full Time Result (1X2) when present, otherwise the first "Match Winner" market (moneyline).
 */
export function extractMainLineOdds(
  conditions: ConditionDetailedData[],
): TopOddsLine[] | null {
  if (!conditions.length) {
    return null;
  }
  try {
    const markets = groupConditionsByMarket(conditions);
    const fullTime = markets.find((m) => m.marketKey === "1-1-1");
    const matchWinner = markets.find((m) =>
      /match winner/i.test(m.name),
    );
    const main = fullTime ?? matchWinner ?? markets[0];
    const firstCondition = main?.conditions[0];
    if (!firstCondition?.outcomes?.length) {
      return null;
    }
    return firstCondition.outcomes.map((o) => ({
      label: o.selectionName,
      odds:
        Number.isFinite(o.odds) && o.odds > 0 ? o.odds.toFixed(2) : "—",
    }));
  } catch {
    return null;
  }
}

export type GameCardProps = {
  game: GameData;
  topOdds?: TopOddsLine[] | null;
};

export function GameCard({ game, topOdds }: GameCardProps) {
  const { addSelection } = useBetslip();
  const names = participantLine(game);
  const when = formatStartTime(game.startsAt);

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-zinc-100">{names}</h2>
          <p className="mt-1 text-xs tabular-nums text-zinc-500">{when}</p>
        </div>
        {topOdds && topOdds.length > 0 ? (
          <div
            className="flex shrink-0 gap-1.5 sm:max-w-[min(100%,22rem)]"
            aria-label="Main odds"
          >
            {topOdds.map((line) => (
              <button
                key={`${line.label}-${line.odds}`}
                type="button"
                onClick={() =>
                  addSelection({
                    gameId: game.gameId,
                    outcomeName: line.label,
                    odds: line.odds,
                  })
                }
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md bg-zinc-800/80 px-2 py-1.5 text-left transition-colors hover:bg-zinc-700/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
              >
                <span className="max-w-full truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  {line.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-zinc-100">
                  {line.odds}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="shrink-0 text-xs text-zinc-600">Odds unavailable</p>
        )}
      </div>
    </article>
  );
}
