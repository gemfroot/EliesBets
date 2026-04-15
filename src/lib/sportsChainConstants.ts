import { polygon } from "viem/chains";
import { HEADER_SWITCHER_CHAIN_IDS } from "@/lib/chains";

/**
 * Client-safe defaults (no `next/headers`). Import from here in `"use client"` modules.
 * Server code that reads cookies uses `getSportsChainId()` in `@/lib/sportsChain`.
 */
export const DEFAULT_SPORTS_CHAIN_ID = polygon.id;

export function isValidSportsChainId(id: number): boolean {
  return (HEADER_SWITCHER_CHAIN_IDS as readonly number[]).includes(id);
}
