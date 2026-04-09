"use client";

import { useCallback, useMemo } from "react";
import type { PublicClient } from "viem";
import { zeroAddress } from "viem";
import { readContract } from "viem/actions";
import { MAX_HOUSE_EGDE, coinTossAbi, defaultCasinoGameParams } from "@betswirl/sdk-core";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  getCasinoBankAddress,
  getCasinoCoinTossAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
import type { CasinoContracts, CasinoTxHash } from "@/lib/casino/types";

const NATIVE_TOKEN = zeroAddress;

export function useCasinoContracts(): CasinoContracts {
  const chainId = useChainId();
  const bank = useMemo(() => getCasinoBankAddress(chainId), [chainId]);
  const coinToss = useMemo(() => getCasinoCoinTossAddress(chainId), [chainId]);
  return {
    chainId,
    bank,
    coinToss,
    bankConfigured: isCasinoAddressConfigured(bank),
    coinTossConfigured: isCasinoAddressConfigured(coinToss),
  };
}

/**
 * Minimum total native amount for a single coin toss: Chainlink VRF fee plus at least 1 wei
 * toward the bet (`msg.value` splits into VRF cost + `betAmount`).
 */
export function useCoinTossMinBet() {
  const { coinToss, coinTossConfigured } = useCasinoContracts();

  const { data: vrfCost, isPending: vrfPending } = useReadContract({
    address: coinToss,
    abi: coinTossAbi,
    functionName: "getChainlinkVRFCost",
    args: [NATIVE_TOKEN, 1],
    query: {
      enabled: coinTossConfigured,
    },
  });

  const minTotal = useMemo(() => {
    if (vrfCost === undefined) return undefined;
    return vrfCost + BigInt(1);
  }, [vrfCost]);

  return {
    data: minTotal,
    isPending: vrfPending,
  };
}

export function useCoinTossWager() {
  const { coinToss, coinTossConfigured } = useCasinoContracts();
  const { address: connected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, ...rest } = useWriteContract();

  const placeWager = useCallback(
    async (betHeads: boolean, valueWei: bigint): Promise<CasinoTxHash> => {
      if (!publicClient) {
        throw new Error("Wallet client not available");
      }
      const vrfCost = await readContract(publicClient as PublicClient, {
        address: coinToss,
        abi: coinTossAbi,
        functionName: "getChainlinkVRFCost",
        args: [NATIVE_TOKEN, 1],
      });
      const betAmount = valueWei > vrfCost ? valueWei - vrfCost : BigInt(0);

      return writeContractAsync({
        address: coinToss,
        abi: coinTossAbi,
        functionName: "wager",
        args: [
          betHeads,
          connected ?? zeroAddress,
          zeroAddress,
          {
            token: NATIVE_TOKEN,
            betAmount,
            betCount: defaultCasinoGameParams.betCount,
            stopGain: defaultCasinoGameParams.stopGain,
            stopLoss: defaultCasinoGameParams.stopLoss,
            maxHouseEdge: MAX_HOUSE_EGDE,
          },
        ],
        value: valueWei,
      });
    },
    [coinToss, connected, publicClient, writeContractAsync],
  );

  return {
    placeWager,
    /** True when the coin toss contract address is known for this chain. */
    canWager: coinTossConfigured,
    ...rest,
  };
}
