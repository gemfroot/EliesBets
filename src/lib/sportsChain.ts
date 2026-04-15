import { cookies } from "next/headers";
import { cookieKeys } from "@azuro-org/sdk";
import { polygon } from "viem/chains";
import { HEADER_SWITCHER_CHAIN_IDS } from "@/lib/chains";

/** Default when no `appChainId` cookie or invalid value. */
export const DEFAULT_SPORTS_CHAIN_ID = polygon.id;

export function isValidSportsChainId(id: number): boolean {
  return (HEADER_SWITCHER_CHAIN_IDS as readonly number[]).includes(id);
}

/**
 * Resolves Azuro/toolkit `chainId` for server components and route handlers.
 * Uses the same `appChainId` cookie as `@azuro-org/sdk` (`setAppChainId`).
 */
export async function getSportsChainId(): Promise<number> {
  const jar = await cookies();
  const raw = jar.get(cookieKeys.appChainId)?.value;
  if (!raw) return DEFAULT_SPORTS_CHAIN_ID;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isValidSportsChainId(n)) {
    return DEFAULT_SPORTS_CHAIN_ID;
  }
  return n;
}
