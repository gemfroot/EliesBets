import { cookies } from "next/headers";
import type { SportsChainId } from "@/lib/sportsChainConstants";
import {
  DEFAULT_SPORTS_CHAIN_ID,
  isValidSportsChainId,
} from "@/lib/sportsChainConstants";

export type { SportsChainId } from "@/lib/sportsChainConstants";
export { DEFAULT_SPORTS_CHAIN_ID, isValidSportsChainId } from "@/lib/sportsChainConstants";

/**
 * Resolves Azuro/toolkit `chainId` for server components and route handlers.
 * Uses the same `appChainId` cookie as `@azuro-org/sdk` (`setAppChainId`).
 */
/** Must match `cookieKeys.appChainId` from `@azuro-org/sdk` (avoid importing SDK here — pulls React into API routes). */
const APP_CHAIN_ID_COOKIE = "appChainId" as const;

export async function getSportsChainId(): Promise<SportsChainId> {
  const jar = await cookies();
  const raw = jar.get(APP_CHAIN_ID_COOKIE)?.value;
  if (!raw) return DEFAULT_SPORTS_CHAIN_ID;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isValidSportsChainId(n)) {
    return DEFAULT_SPORTS_CHAIN_ID;
  }
  return n;
}
