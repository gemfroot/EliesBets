import { polygon, gnosis, base } from "viem/chains";
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

/**
 * URL-slug ↔ chain-id mapping. Used to put the chain in the route path so list
 * routes are statically generable (no cookies → no dynamic rendering). Keep the
 * slugs stable: changing them breaks bookmarks and the sitemap.
 */
export const CHAIN_SLUG_BY_ID = {
  [polygon.id]: "polygon",
  [gnosis.id]: "gnosis",
  [base.id]: "base",
} as const satisfies Record<SportsChainId, string>;

export type ChainSlug = (typeof CHAIN_SLUG_BY_ID)[SportsChainId];

const CHAIN_ID_BY_SLUG: Record<ChainSlug, SportsChainId> = {
  polygon: polygon.id,
  gnosis: gnosis.id,
  base: base.id,
};

export const CHAIN_SLUGS = Object.keys(CHAIN_ID_BY_SLUG) as ChainSlug[];

export const DEFAULT_CHAIN_SLUG: ChainSlug =
  CHAIN_SLUG_BY_ID[DEFAULT_SPORTS_CHAIN_ID];

export function isChainSlug(value: string): value is ChainSlug {
  return value in CHAIN_ID_BY_SLUG;
}

export function chainSlugFromId(id: SportsChainId): ChainSlug {
  return CHAIN_SLUG_BY_ID[id];
}

export function chainIdFromSlug(slug: ChainSlug): SportsChainId {
  return CHAIN_ID_BY_SLUG[slug];
}
