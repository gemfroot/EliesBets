"use client";

import { useState, type ReactNode } from "react";
import { ConditionState, type Market, type MarketOutcome } from "@azuro-org/toolkit";
import { OddsButton } from "@/components/OddsButton";
import { useBetslip } from "@/components/Betslip";

function formatOdds(odds: number): string {
  return Number.isFinite(odds) && odds > 0 ? odds.toFixed(2) : "—";
}

export type MarketGroupProps = {
  title: string;
  markets: Market[];
  defaultOpen?: boolean;
};

function OutcomeButton({
  gameId,
  outcome,
  conditionState,
}: {
  gameId: string;
  outcome: MarketOutcome;
  conditionState: ConditionState;
}) {
  const { addSelection } = useBetslip();
  const oddsStr = formatOdds(outcome.odds);
  const suspended = conditionState !== ConditionState.Active;

  return (
    <OddsButton
      gameId={gameId}
      outcomeName={outcome.selectionName}
      outcomeId={outcome.outcomeId}
      odds={outcome.odds}
      disabled={suspended}
      label={outcome.selectionName}
      onClick={() =>
        addSelection({
          gameId,
          outcomeName: outcome.selectionName,
          odds: oddsStr,
          outcomeId: outcome.outcomeId,
          conditionId: outcome.conditionId,
        })
      }
    />
  );
}

function ConditionBlock({
  gameId,
  label,
  outcomes,
  conditionState,
}: {
  gameId: string;
  label: ReactNode;
  outcomes: MarketOutcome[];
  conditionState: ConditionState;
}) {
  if (!outcomes.length) {
    return null;
  }
  const n = outcomes.length;
  const gridCols =
    n <= 3 ? `repeat(${n}, minmax(0, 1fr))` : "repeat(auto-fill, minmax(7rem, 1fr))";

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
      {label}
      <div
        className="mt-2 grid gap-1.5"
        style={{ gridTemplateColumns: gridCols }}
      >
        {outcomes.map((o) => (
          <OutcomeButton
            key={o.outcomeId}
            gameId={gameId}
            outcome={o}
            conditionState={conditionState}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsible block for one logical market category (e.g. 1X2, Over/Under),
 * possibly containing several Azuro markets (lines).
 */
export function MarketGroup({
  title,
  markets,
  defaultOpen = true,
}: MarketGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group rounded-lg border border-zinc-800 bg-zinc-900/40"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          <span
            className="text-zinc-500 transition group-open:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </div>
      </summary>
      <div className="flex flex-col gap-4 border-t border-zinc-800 px-4 pb-4 pt-3">
        {markets.map((market) => {
          const gameId = market.conditions[0]?.outcomes[0]?.gameId ?? "";
          const showMarketName = markets.length > 1;
          return (
            <div key={market.marketKey} className="flex flex-col gap-2">
              {showMarketName && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {market.name}
                </h3>
              )}
              <div className="flex flex-col gap-3">
                {market.conditions.map((cond) => (
                  <ConditionBlock
                    key={cond.conditionId}
                    gameId={gameId}
                    conditionState={cond.state}
                    label={
                      market.conditions.length > 1 && cond.margin ? (
                        <p className="text-xs text-zinc-400">{cond.margin}</p>
                      ) : null
                    }
                    outcomes={cond.outcomes}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
