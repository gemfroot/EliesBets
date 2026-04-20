"use client";

import { useChainId, useConnection } from "wagmi";
import { normalizeChainId } from "@/lib/chains";

/**
 * The wallet's reported chain when connected; otherwise wagmi's configured chain id.
 * Prefer over raw `useChainId()` alone: wagmi state can stick to the first configured
 * chain while the wallet is on a network not listed in `createConfig({ chains })`
 * (e.g. Optimism), so the header would wrongly show "Polygon" with no unsupported hint.
 */
export function useWalletChainId(): number {
  const { chainId: connectionChainId } = useConnection();
  const configChainId = useChainId();
  const fromWallet = normalizeChainId(connectionChainId);
  return fromWallet !== undefined ? fromWallet : configChainId;
}
