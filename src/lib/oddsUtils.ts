import {
  getConditionsByGameIds,
  groupConditionsByMarket,
  type ConditionDetailedData,
} from "@azuro-org/toolkit";
import { CHAIN_ID } from "@/lib/constants";
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

export async function fetchTopOddsByGameId(
  gameIds: string[],
): Promise<Map<string, ReturnType<typeof extractMainLineOdds>>> {
  const result = new Map<string, ReturnType<typeof extractMainLineOdds>>();
  if (!gameIds.length) {
    return result;
  }
  const batches = chunk(gameIds, CONDITIONS_BATCH_SIZE);
  for (let i = 0; i < batches.length; i += CONDITIONS_FETCH_CONCURRENCY) {
    const wave = batches.slice(i, i + CONDITIONS_FETCH_CONCURRENCY);
    const partialMaps = await Promise.all(
      wave.map(async (batch) => {
        const conditions = await getConditionsByGameIds({
          chainId: CHAIN_ID,
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
        const batchResult = new Map<
          string,
          ReturnType<typeof extractMainLineOdds>
        >();
        for (const gid of batch) {
          batchResult.set(gid, extractMainLineOdds(byGameId.get(gid) ?? []));
        }
        return batchResult;
      }),
    );
    for (const m of partialMaps) {
      for (const [gid, odds] of m) {
        result.set(gid, odds);
      }
    }
  }
  return result;
}
