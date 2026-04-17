import { polygon } from "viem/chains";
import { HEADER_SWITCHER_CHAIN_IDS } from "@/lib/chains";

/**
 * Client-safe defaults (no `next/headers`). Import from here in `"use client"` modules.
 * Server code that reads cookies uses `getSportsChainId()` in `@/lib/sportsChain`.
 */
export const DEFAULT_SPORTS_CHAIN_ID = polygon.id;

/** Polygon, Gnosis, or Base — matches Azuro toolkit `chainId` unions for sports. */
export type SportsChainId = (typeof HEADER_SWITCHER_CHAIN_IDS)[number];

export function isValidSportsChainId(id: number): id is SportsChainId {
  return (HEADER_SWITCHER_CHAIN_IDS as readonly number[]).includes(id);
}
