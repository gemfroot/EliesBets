"use client";

import { useChain } from "@azuro-org/sdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConnection, useChainId } from "wagmi";
import { HEADER_SWITCHER_CHAIN_IDS } from "@/lib/chains";

/**
 * Keeps Azuro `appChainId` aligned with the wallet when the user is on Polygon or Gnosis
 * (e.g. after switching network in the wallet). Updates the SDK cookie and refreshes RSC data.
 */
export function SportsChainSync() {
  const router = useRouter();
  const { isConnected } = useConnection();
  const chainId = useChainId();
  const { appChain, setAppChainId } = useChain();

  useEffect(() => {
    if (!isConnected) return;
    if (!(HEADER_SWITCHER_CHAIN_IDS as readonly number[]).includes(chainId)) return;
    if (chainId === appChain.id) return;
    setAppChainId(chainId);
    router.refresh();
  }, [isConnected, chainId, appChain.id, setAppChainId, router]);

  return null;
}
