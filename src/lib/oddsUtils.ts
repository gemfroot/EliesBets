import {
  groupConditionsByMarket,
  type ConditionDetailedData,
} from "@azuro-org/toolkit";

export type TopOddsLine = {
  label: string;
  odds: number;
  outcomeId: string;
  conditionId: string;
  isExpressForbidden: boolean;
};

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
      odds: o.odds,
      outcomeId: o.outcomeId,
      conditionId: firstCondition.conditionId,
      isExpressForbidden: o.isExpressForbidden,
    }));
  } catch {
    return null;
  }
}
