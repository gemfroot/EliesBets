"use client";

import { useChain } from "@azuro-org/sdk";
import { useEffect } from "react";
import type { SportsChainId } from "@/lib/sportsChainConstants";

/**
 * Source-of-truth for Azuro's `appChain` is now the URL segment, not the cookie.
 * This component runs in the `/[chain]/...` layout and syncs the URL-derived
 * chain id into the SDK context so client-only consumers (Betslip, Header
 * balance, etc.) see the right chain without a round-trip through the server.
 *
 * The root layout is static and starts `AzuroSDKProvider` with
 * `DEFAULT_SPORTS_CHAIN_ID`; this effect rewires it the moment the chain
 * layout mounts. `SportsChainSync` then handles the wallet → SDK direction.
 */
export function ChainParamBinder({ chainId }: { chainId: SportsChainId }) {
  const { appChain, setAppChainId } = useChain();
  useEffect(() => {
    if (appChain.id !== chainId) {
      setAppChainId(chainId);
    }
  }, [appChain.id, chainId, setAppChainId]);
  return null;
}
