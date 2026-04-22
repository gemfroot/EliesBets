"use client";

import { usePathname } from "next/navigation";
import {
  DEFAULT_CHAIN_SLUG,
  isChainSlug,
  type ChainSlug,
} from "@/lib/sportsChainConstants";

/**
 * Current chain slug from the URL (the first path segment). Falls back to the
 * default for non-chain routes like `/bets` or `/casino`. Kept as a hook so
 * components re-render when the user navigates to a different chain.
 */
export function useChainSlug(): ChainSlug {
  const pathname = usePathname();
  const first = pathname.split("/", 2)[1];
  if (first && isChainSlug(first)) {
    return first;
  }
  return DEFAULT_CHAIN_SLUG;
}
