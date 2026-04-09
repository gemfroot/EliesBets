"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PublicClient } from "viem";
import { isAddress, zeroAddress } from "viem";
import { readContract } from "viem/actions";
import { MAX_HOUSE_EGDE, defaultCasinoGameParams } from "@betswirl/sdk-core";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { coinTossAbi } from "@/lib/casino/abis/CoinToss";
import {
  getCasinoCoinTossAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
import type { CasinoTxHash } from "@/lib/casino/types";

const NATIVE_TOKEN = zeroAddress;

export interface RollResult {
  id: bigint;
  rolled: readonly boolean[];
  payout: bigint;
  totalBetAmount: bigint;
  face: boolean;
  timestamp: number;
}

/**
 * Coin toss game: reads and writes use the on-chain ABI in `@/lib/casino/abis/CoinToss`.
 */
export function useCoinToss() {
  const chainId = useChainId();
  const coinToss = useMemo(() => getCasinoCoinTossAddress(chainId), [chainId]);
  const coinTossConfigured = isCasinoAddressConfigured(coinToss);
  const { address: connected } = useAccount();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = coinTossConfigured;

  const { data: vrfCost, isPending: vrfPending } = useReadContract({
    address: coinToss,
    abi: coinTossAbi,
    functionName: "getChainlinkVRFCost",
    args: [NATIVE_TOKEN, 1],
    query: { enabled: queryEnabled },
  });

  const { data: paused } = useReadContract({
    address: coinToss,
    abi: coinTossAbi,
    functionName: "paused",
    query: { enabled: queryEnabled },
  });

  const { data: chainTokenConfig } = useReadContract({
    address: coinToss,
    abi: coinTossAbi,
    functionName: "tokens",
    args: [NATIVE_TOKEN],
    query: { enabled: queryEnabled },
  });

  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const rollCountRef = useRef(0);

  useWatchContractEvent({
    address: coinToss,
    abi: coinTossAbi,
    eventName: "Roll",
    args: connected ? { receiver: connected } : undefined,
    enabled: queryEnabled && Boolean(connected),
    onLogs(logs) {
      const last = logs[logs.length - 1];
      if (!last || !("args" in last) || !last.args || typeof last.args !== "object") {
        return;
      }
      const args = last.args as {
        id?: bigint;
        rolled?: readonly boolean[];
        payout?: bigint;
        totalBetAmount?: bigint;
        face?: boolean;
      };
      if (!args.rolled || args.rolled.length === 0) return;
      rollCountRef.current += 1;
      setLastRoll({
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        face: args.face ?? false,
        timestamp: Date.now(),
      });
    },
  });

  const minTotal = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    return vrfCost + BigInt(1);
  }, [vrfCost]);

  const placeWager = useCallback(
    async (betHeads: boolean, valueWei: bigint): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }
      const vrfUnknown = await readContract(publicClient as PublicClient, {
        address: coinToss,
        abi: coinTossAbi,
        functionName: "getChainlinkVRFCost",
        args: [NATIVE_TOKEN, 1],
      });
      const vrf = vrfUnknown as bigint;
      const betAmount = valueWei > vrf ? valueWei - vrf : BigInt(0);

      // BetSwirl requires both receiver and affiliate to be non-zero.
      const envAffiliate = process.env.NEXT_PUBLIC_CASINO_AFFILIATE;
      const affiliate: `0x${string}` =
        envAffiliate && isAddress(envAffiliate) ? envAffiliate : connected;

      return writeContractAsync({
        address: coinToss,
        abi: coinTossAbi,
        functionName: "wager",
        args: [
          betHeads,
          connected,
          affiliate,
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

  const canWager = coinTossConfigured && paused === false;

  return {
    coinTossAddress: coinToss,
    coinTossConfigured,
    vrfCost,
    chainTokenConfig,
    paused,
    lastRoll,
    data: minTotal,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}
