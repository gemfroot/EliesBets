import {
  ConditionState,
  getConditionsByGameIds,
  groupConditionsByMarket,
  type ConditionDetailedData,
} from "@azuro-org/toolkit";
import type { SportsChainId } from "@/lib/sportsChainConstants";
import { chunk } from "@/lib/sportGames";

/** Matches toolkit batching expectations for `getConditionsByGameIds`. */
export const CONDITIONS_BATCH_SIZE = 40;

/** How many condition batches to fetch in parallel (within each wave). */
const CONDITIONS_FETCH_CONCURRENCY = 4;

export type TopOddsLine = {
  label: string;
  odds: number;
  outcomeId: string;
  conditionId: string;
  isExpressForbidden: boolean;
  /** Same as game detail: list cards should not add legs when not Active. */
  conditionState: ConditionState;
};

/** First segment of Azuro `marketKey` (e.g. `"1-1-1"` → `"1"`). Family `"4"` is Over/Under. */
function marketFamilyKey(marketKey: string): string {
  const i = marketKey.indexOf("-");
  return i === -1 ? marketKey : marketKey.slice(0, i);
}

/**
 * Picks Full Time Result (1X2) when present, otherwise the first "Match Winner" market (moneyline).
 * Falls back to the first non–Over/Under market when possible so totals are not shown as the main line.
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
    /** Moneyline / two-way winner: family `19` in Azuro keys (e.g. `19-...`), not localized names. */
    const matchWinnerByKey = markets.find((m) => marketFamilyKey(m.marketKey) === "19");
    const matchWinner =
      matchWinnerByKey ??
      markets.find((m) => /match winner/i.test(m.name));
    const firstNonOu =
      markets.find((m) => marketFamilyKey(m.marketKey) !== "4") ?? null;
    const main =
      fullTime ?? matchWinner ?? firstNonOu ?? markets[0];
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
      conditionState: firstCondition.state,
    }));
  } catch {
    return null;
  }
}

/** "Over (2.5)" → "O 2.5", "Under (6.5)" → "U 6.5" */
function shortenOuLabel(raw: string): string {
  const m = raw.match(/^(over|under)\s*\((.+)\)$/i);
  if (!m) return raw;
  return `${m[1]!.charAt(0).toUpperCase()} ${m[2]}`;
}

/**
 * Over/Under for the primary total line (first condition after toolkit ordering — lowest line).
 */
export function extractOverUnderOdds(
  conditions: ConditionDetailedData[],
): TopOddsLine[] | null {
  if (!conditions.length) {
    return null;
  }
  try {
    const markets = groupConditionsByMarket(conditions);
    const ou = markets.find((m) => marketFamilyKey(m.marketKey) === "4");
    const firstCondition = ou?.conditions[0];
    if (!firstCondition?.outcomes?.length) {
      return null;
    }
    return firstCondition.outcomes.map((o) => ({
      label: shortenOuLabel(o.selectionName),
      odds: o.odds,
      outcomeId: o.outcomeId,
      conditionId: firstCondition.conditionId,
      isExpressForbidden: o.isExpressForbidden,
      conditionState: firstCondition.state,
    }));
  } catch {
    return null;
  }
}

/** Distinct market types for this game (matches game detail grouping). */
export function countGameMarkets(conditions: ConditionDetailedData[]): number {
  if (!conditions.length) {
    return 0;
  }
  try {
    return groupConditionsByMarket(conditions).length;
  } catch {
    return 0;
  }
}

export type GameOddsData = {
  topOdds: TopOddsLine[] | null;
  overUnderOdds: TopOddsLine[] | null;
  marketCount: number;
  /** Unix ms when this row was built (for list card staleness). */
  fetchedAt: number;
};

export async function fetchTopOddsByGameId(
  gameIds: string[],
  chainId: SportsChainId,
): Promise<Map<string, GameOddsData>> {
  const result = new Map<string, GameOddsData>();
  if (!gameIds.length) {
    return result;
  }
  const batches = chunk(gameIds, CONDITIONS_BATCH_SIZE);
  for (let i = 0; i < batches.length; i += CONDITIONS_FETCH_CONCURRENCY) {
    const wave = batches.slice(i, i + CONDITIONS_FETCH_CONCURRENCY);
    const partialMaps = await Promise.all(
      wave.map(async (batch) => {
        const conditions = await getConditionsByGameIds({
          chainId,
          gameIds: batch,
        });
        const byGameId = new Map<string, typeof conditions>();
        for (const c of conditions) {
          const gid = c.game.gameId;
          const list = byGameId.get(gid);
          if (list) {
            list.push(c);
          } else {
            byGameId.set(gid, [c]);
          }
        }
        const batchResult = new Map<string, GameOddsData>();
        const fetchedAt = Date.now();
        for (const gid of batch) {
          const conds = byGameId.get(gid) ?? [];
          batchResult.set(gid, {
            topOdds: extractMainLineOdds(conds),
            overUnderOdds: extractOverUnderOdds(conds),
            marketCount: countGameMarkets(conds),
            fetchedAt,
          });
        }
        return batchResult;
      }),
    );
    for (const m of partialMaps) {
      for (const [gid, data] of m) {
        result.set(gid, data);
      }
    }
  }
  return result;
}
