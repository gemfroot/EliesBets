"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicClient } from "viem";
import {
  decodeFunctionResult,
  encodeFunctionData,
  isAddress,
  zeroAddress,
} from "viem";
import { getGasPrice } from "viem/actions";
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
 * getChainlinkVRFCost uses tx.gasprice internally, which is 0 in a normal
 * eth_call. We must pass the current gasPrice to get the real cost.
 */
async function fetchVrfCostWithGasPrice(
  client: PublicClient,
  contractAddress: `0x${string}`,
  callerAddress: `0x${string}`,
): Promise<bigint> {
  const gasPrice = await getGasPrice(client);
  // 20% buffer so the tx doesn't revert if gas spikes between read and submit
  const buffered = (gasPrice * BigInt(120)) / BigInt(100);
  const data = encodeFunctionData({
    abi: coinTossAbi,
    functionName: "getChainlinkVRFCost",
    args: [NATIVE_TOKEN, 1],
  });
  const result = await client.call({
    to: contractAddress,
    data,
    gasPrice: buffered,
    from: callerAddress,
    gas: BigInt(100_000),
  });
  if (!result.data) return BigInt(0);
  return decodeFunctionResult({
    abi: coinTossAbi,
    functionName: "getChainlinkVRFCost",
    data: result.data,
  }) as bigint;
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

  // VRF cost with gas price context — polled every 30s
  const [vrfCost, setVrfCost] = useState<bigint | undefined>(undefined);
  const [vrfPending, setVrfPending] = useState(true);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setVrfCost(undefined);
      setVrfPending(false);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        setVrfPending(true);
        const cost = await fetchVrfCostWithGasPrice(
          publicClient as PublicClient,
          coinToss,
          connected!,
        );
        if (!cancelled) {
          setVrfCost(cost);
          setVrfPending(false);
        }
      } catch {
        if (!cancelled) setVrfPending(false);
      }
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [queryEnabled, publicClient, coinToss, connected]);

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

      // Fetch fresh VRF cost with gas price context right before submitting
      const vrf = await fetchVrfCostWithGasPrice(
        publicClient as PublicClient,
        coinToss,
        connected,
      );
      const betAmount = valueWei > vrf ? valueWei - vrf : BigInt(0);
      if (betAmount === BigInt(0)) {
        throw new Error(
          "Stake too low to cover VRF fee. Increase your stake amount.",
        );
      }

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
