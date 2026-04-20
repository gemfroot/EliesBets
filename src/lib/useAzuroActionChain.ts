"use client";

import { useCallback } from "react";
import { useChain } from "@azuro-org/sdk";
import { useSwitchChain } from "wagmi";
import { chainName } from "@/lib/chains";
import { useWalletChainId } from "@/lib/useWalletChainId";

/** Wallet must match Azuro `appChain` before claim / cashout txs. */
export function useAzuroActionChain() {
  const { appChain } = useChain();
  const walletChainId = useWalletChainId();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const onBetChain = walletChainId === appChain.id;

  const switchToAppChain = useCallback(async () => {
    await switchChainAsync({ chainId: appChain.id });
  }, [appChain.id, switchChainAsync]);

  return {
    appChainId: appChain.id,
    walletChainId,
    onBetChain,
    switchPending,
    switchToAppChain,
    appChainName: chainName(appChain.id),
    walletChainName: chainName(walletChainId),
  };
}
