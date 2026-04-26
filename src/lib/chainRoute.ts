import {
  CHAIN_SLUG_BY_ID,
  CHAIN_SLUGS,
  type SportsChainId,
} from "@/lib/sportsChainConstants";

/**
 * Decides where to navigate the user when they switch the sports chain in the
 * header. Pure so it can be unit-tested.
 *
 * - `/[chain]/sports/...`, `/[chain]/live`, `/[chain]` → swap the chain
 *   segment in place; the user stays on the equivalent page on the new chain.
 *
 * - `/games/[id]` → redirect to the new chain's sports home. The page reads
 *   its data from the `appChainId` cookie (`getSportsChainId()`); without
 *   navigating, the URL stays put while the wallet jumps to the new chain,
 *   leaving the user looking at a Polygon game with a Base wallet (or vice
 *   versa). The game id is per-chain anyway, so staying put would 404 on the
 *   new chain.
 *
 * - Other non-chain-scoped routes (`/`, `/bets`, `/casino`, `/casino/*`,
 *   `/privacy`, `/terms`, `/api/...`) → return null. Those pages are either
 *   wallet-driven (casino), cross-chain by design (bets), or chain-agnostic
 *   (legal). The header should switch the wallet without yanking the user
 *   off the page.
 */
export function rewriteChainInPath(
  pathname: string,
  target: SportsChainId,
): string | null {
  const nextSlug = CHAIN_SLUG_BY_ID[target];
  if (!nextSlug) return null;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && (CHAIN_SLUGS as readonly string[]).includes(first)) {
    segments[0] = nextSlug;
    return `/${segments.join("/")}`;
  }
  if (first === "games") {
    return `/${nextSlug}/sports`;
  }
  return null;
}
