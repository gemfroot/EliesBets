"use client";

import { useState, type ReactNode } from "react";
import { ConditionState, type Market, type MarketOutcome } from "@azuro-org/toolkit";
import { OddsButton } from "@/components/OddsButton";
import { useBetslipActions } from "@/components/Betslip";
import { getOutcomeDisplayLabel } from "@/lib/outcomeLabels";
import { encodeSlipDecimalOdds } from "@/lib/oddsFormat";

export type MarketGroupProps = {
  title: string;
  markets: Market[];
  /** Azuro game id for betslip selections; must be non-empty. */
  gameId: string;
  /** Match title for receipts (e.g. Team A vs Team B). */
  gameTitle: string;
  sportSlug: string;
  participants: readonly { name: string }[];
  defaultOpen?: boolean;
};

function OutcomeButton({
  gameId,
  gameTitle,
  sportSlug,
  participants,
  outcome,
  conditionState,
}: {
  gameId: string;
  gameTitle: string;
  sportSlug: string;
  participants: readonly { name: string }[];
  outcome: MarketOutcome;
  conditionState: ConditionState;
}) {
  const { addSelection } = useBetslipActions();
  const oddsStr =
    Number.isFinite(outcome.odds) && outcome.odds > 0
      ? encodeSlipDecimalOdds(outcome.odds)
      : "—";
  const suspended = conditionState !== ConditionState.Active;
  const displayName = getOutcomeDisplayLabel(outcome.selectionName, {
    sportSlug,
    participants,
  });

  return (
    <OddsButton
      gameId={gameId}
      outcomeName={displayName}
      outcomeId={outcome.outcomeId}
      odds={outcome.odds}
      disabled={suspended}
      label={displayName}
      onClick={() =>
        addSelection({
          gameId,
          gameTitle,
          outcomeName: displayName,
          odds: oddsStr,
          outcomeId: outcome.outcomeId,
          conditionId: outcome.conditionId,
          isExpressForbidden: outcome.isExpressForbidden,
          listConditionStateAtAdd: conditionState,
        })
      }
    />
  );
}

function ConditionBlock({
  gameId,
  gameTitle,
  sportSlug,
  participants,
  label,
  outcomes,
  conditionState,
}: {
  gameId: string;
  gameTitle: string;
  sportSlug: string;
  participants: readonly { name: string }[];
  label: ReactNode;
  outcomes: MarketOutcome[];
  conditionState: ConditionState;
}) {
  if (!outcomes.length) {
    return null;
  }
  const n = outcomes.length;
  const mdGridClass =
    n <= 3
      ? n === 1
        ? "md:grid-cols-1"
        : n === 2
          ? "md:grid-cols-2"
          : "md:grid-cols-3"
      : "md:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]";

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
      {label}
      <div className={`mt-2 grid grid-cols-1 gap-2 md:gap-1.5 ${mdGridClass}`}>
        {outcomes.map((o) => (
          <OutcomeButton
            key={o.outcomeId}
            gameId={gameId}
            gameTitle={gameTitle}
            sportSlug={sportSlug}
            participants={participants}
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
  gameId,
  gameTitle,
  sportSlug,
  participants,
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
          const showMarketName = markets.length > 1;
          return (
            <div key={market.marketKey} className="flex flex-col gap-2">
              {showMarketName && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {market.name}
                </h3>
              )}
              <div className="flex flex-col gap-2">
                {market.conditions.map((cond) => (
                  <ConditionBlock
                    key={cond.conditionId}
                    gameId={gameId}
                    gameTitle={gameTitle}
                    sportSlug={sportSlug}
                    participants={participants}
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
