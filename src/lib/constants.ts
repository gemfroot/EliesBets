/**
 * Default Polygon mainnet id for legacy call sites.
 * Server-side sports data should use `getSportsChainId()` from `@/lib/sportsChain`; defaults in
 * `@/lib/sportsChainConstants` are safe for client bundles.
 * match the Azuro `appChainId` cookie (Polygon or Gnosis).
 */
export const CHAIN_ID = 137 as const;
