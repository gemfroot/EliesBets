"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicClient } from "viem";
import {
  decodeFunctionResult,
  encodeFunctionData,
  isAddress,
} from "viem";
import { getBlockNumber, getContractEvents } from "viem/actions";
import {
  MAX_HOUSE_EGDE,
  defaultCasinoGameParams,
  parseRawWeightedGameConfiguration,
  type CasinoChainId,
  type WeightedGameConfiguration,
} from "@betswirl/sdk-core";
import {
  useConnection,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { useWalletChainId } from "@/lib/useWalletChainId";
import { coinTossAbi } from "@/lib/casino/abis/CoinToss";
import { diceAbi } from "@/lib/casino/abis/Dice";
import { kenoAbi } from "@/lib/casino/abis/Keno";
import { rouletteAbi } from "@/lib/casino/abis/Roulette";
import { wheelAbi } from "@/lib/casino/abis/Wheel";
import {
  getCasinoCoinTossAddress,
  getCasinoDiceAddress,
  getCasinoKenoAddress,
  getCasinoPlinkoAddress,
  getCasinoRouletteAddress,
  getCasinoWheelAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
import type { CasinoTxHash } from "@/lib/casino/types";

import type { Address } from "viem";
import type { BetToken } from "@/lib/casino/addresses";
import { getDefaultBetToken } from "@/lib/casino/addresses";

/** Total lookback depth for initial bet-history load (per chain). */
const ROLL_EVENT_LOOKBACK_BLOCKS_BY_CHAIN: Record<number, bigint> = {
  137: BigInt(200_000),      // Polygon — ~4.5 days @ 2s
  80002: BigInt(100_000),    // Amoy
  100: BigInt(100_000),      // Gnosis
  43114: BigInt(100_000),    // Avalanche — ~2.3 days @ 2s
  43113: BigInt(100_000),    // Fuji
  8453: BigInt(40_000),      // Base public RPC is restrictive; keep it short
};
const ROLL_EVENT_LOOKBACK_DEFAULT = BigInt(40_000);
/** Max block span per eth_getLogs call. Base public RPC caps ~2k. */
const ROLL_EVENT_CHUNK_BLOCKS = BigInt(2_000);
const MAX_BET_HISTORY = 100;

function lookbackFor(chainId: number): bigint {
  return ROLL_EVENT_LOOKBACK_BLOCKS_BY_CHAIN[chainId] ?? ROLL_EVENT_LOOKBACK_DEFAULT;
}

/**
 * Chunked wrapper around viem's getContractEvents. Splits the block range into
 * spans of ROLL_EVENT_CHUNK_BLOCKS to stay under restrictive public-RPC limits
 * (Base's mainnet.base.org caps eth_getLogs ranges around 2k blocks).
 */
async function getContractEventsChunked(
  client: PublicClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any & { fromBlock: bigint; toBlock: bigint },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const { fromBlock, toBlock, ...rest } = args as {
    fromBlock: bigint;
    toBlock: bigint;
    [k: string]: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const end = cursor + ROLL_EVENT_CHUNK_BLOCKS - BigInt(1);
    const chunkEnd = end > toBlock ? toBlock : end;
    const logs = await getContractEvents(client, {
      ...rest,
      fromBlock: cursor,
      toBlock: chunkEnd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    for (const l of logs) all.push(l);
    cursor = chunkEnd + BigInt(1);
  }
  return all;
}

const MIN_VRF_BUDGET_BY_CHAIN: Record<number, bigint> = {
  43114: BigInt(10_000_000_000_000_000),   // 0.01 AVAX
  8453:  BigInt(500_000_000_000_000),       // 0.0005 ETH
  137:   BigInt(100_000_000_000_000_000),   // 0.1 POL
};
const DEFAULT_MIN_VRF_BUDGET = BigInt(10_000_000_000_000_000);
function getMinVrfBudget(chainId: number): bigint {
  return MIN_VRF_BUDGET_BY_CHAIN[chainId] ?? DEFAULT_MIN_VRF_BUDGET;
}

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const betHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `coinToss.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

function rollSortKeyFromLog(log: {
  blockNumber?: bigint | null;
  logIndex?: number | null;
}): bigint {
  const bn = log.blockNumber ?? BigInt(0);
  const li = BigInt(log.logIndex ?? 0);
  return bn * BigInt(1_000_000) + li;
}

function parseStoredBetHistory(raw: string | null): RollResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RollResult[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o.id;
      const payout = o.payout;
      const totalBetAmount = o.totalBetAmount;
      const rolled = o.rolled;
      const face = o.face;
      const timestamp = o.timestamp;
      if (typeof id !== "string" || typeof payout !== "string" || typeof totalBetAmount !== "string")
        continue;
      if (!Array.isArray(rolled) || rolled.some((x) => typeof x !== "boolean")) continue;
      if (typeof face !== "boolean" || typeof timestamp !== "number") continue;
      out.push({
        id: BigInt(id),
        rolled: rolled as boolean[],
        payout: BigInt(payout),
        totalBetAmount: BigInt(totalBetAmount),
        face,
        timestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeBetHistory(rolls: RollResult[]): string {
  return JSON.stringify(
    rolls.map((r) => ({
      id: r.id.toString(),
      rolled: [...r.rolled],
      payout: r.payout.toString(),
      totalBetAmount: r.totalBetAmount.toString(),
      face: r.face,
      timestamp: r.timestamp,
    })),
  );
}

function mergeBetHistoryById(existing: RollResult[], incoming: RollResult[]): RollResult[] {
  const byId = new Map<string, RollResult>();
  for (const r of [...existing, ...incoming]) {
    const id = r.id.toString();
    const prev = byId.get(id);
    byId.set(id, !prev || r.timestamp >= prev.timestamp ? r : prev);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BET_HISTORY);
}

function rollFromDecodedLog(
  args: {
    id?: bigint;
    rolled?: readonly boolean[];
    payout?: bigint;
    totalBetAmount?: bigint;
    face?: boolean;
  },
  log: { blockNumber?: bigint | null; logIndex?: number | null },
): RollResult | null {
  if (!args.rolled || args.rolled.length === 0) return null;
  const ts = Number(rollSortKeyFromLog(log));
  return {
    id: args.id ?? BigInt(0),
    rolled: args.rolled,
    payout: args.payout ?? BigInt(0),
    totalBetAmount: args.totalBetAmount ?? BigInt(0),
    face: args.face ?? false,
    timestamp: ts,
  };
}

export interface RollResult {
  id: bigint;
  rolled: readonly boolean[];
  payout: bigint;
  totalBetAmount: bigint;
  face: boolean;
  timestamp: number;
}

const diceBetHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `dice.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

export interface DiceRollResult {
  id: bigint;
  rolled: readonly number[];
  payout: bigint;
  totalBetAmount: bigint;
  cap: number;
  timestamp: number;
}

function parseStoredDiceBetHistory(raw: string | null): DiceRollResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DiceRollResult[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o.id;
      const payout = o.payout;
      const totalBetAmount = o.totalBetAmount;
      const rolled = o.rolled;
      const cap = o.cap;
      const timestamp = o.timestamp;
      if (typeof id !== "string" || typeof payout !== "string" || typeof totalBetAmount !== "string")
        continue;
      if (!Array.isArray(rolled) || rolled.some((x) => typeof x !== "number")) continue;
      if (typeof cap !== "number" || typeof timestamp !== "number") continue;
      out.push({
        id: BigInt(id),
        rolled: rolled as number[],
        payout: BigInt(payout),
        totalBetAmount: BigInt(totalBetAmount),
        cap,
        timestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeDiceBetHistory(rolls: DiceRollResult[]): string {
  return JSON.stringify(
    rolls.map((r) => ({
      id: r.id.toString(),
      rolled: [...r.rolled],
      payout: r.payout.toString(),
      totalBetAmount: r.totalBetAmount.toString(),
      cap: r.cap,
      timestamp: r.timestamp,
    })),
  );
}

function mergeDiceBetHistoryById(
  existing: DiceRollResult[],
  incoming: DiceRollResult[],
): DiceRollResult[] {
  const byId = new Map<string, DiceRollResult>();
  for (const r of [...existing, ...incoming]) {
    const id = r.id.toString();
    const prev = byId.get(id);
    byId.set(id, !prev || r.timestamp >= prev.timestamp ? r : prev);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BET_HISTORY);
}

function diceRollFromDecodedLog(
  args: {
    id?: bigint;
    rolled?: readonly number[];
    payout?: bigint;
    totalBetAmount?: bigint;
    cap?: number;
  },
  log: { blockNumber?: bigint | null; logIndex?: number | null },
): DiceRollResult | null {
  if (!args.rolled || args.rolled.length === 0) return null;
  const ts = Number(rollSortKeyFromLog(log));
  return {
    id: args.id ?? BigInt(0),
    rolled: args.rolled,
    payout: args.payout ?? BigInt(0),
    totalBetAmount: args.totalBetAmount ?? BigInt(0),
    cap: args.cap ?? 0,
    timestamp: ts,
  };
}

const rouletteBetHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `roulette.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

export interface RouletteRollResult {
  id: bigint;
  rolled: readonly number[];
  payout: bigint;
  totalBetAmount: bigint;
  /** Encoded selection (`numbers` on the Roll event, uint40). */
  numbers: bigint;
  timestamp: number;
}

function parseStoredRouletteBetHistory(raw: string | null): RouletteRollResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RouletteRollResult[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o.id;
      const payout = o.payout;
      const totalBetAmount = o.totalBetAmount;
      const rolled = o.rolled;
      const numbersRaw = o.numbers ?? o.configId;
      const timestamp = o.timestamp;
      if (typeof id !== "string" || typeof payout !== "string" || typeof totalBetAmount !== "string")
        continue;
      if (!Array.isArray(rolled) || rolled.some((x) => typeof x !== "number")) continue;
      if (
        (typeof numbersRaw !== "string" && typeof numbersRaw !== "number") ||
        typeof timestamp !== "number"
      )
        continue;
      out.push({
        id: BigInt(id),
        rolled: rolled as number[],
        payout: BigInt(payout),
        totalBetAmount: BigInt(totalBetAmount),
        numbers:
          typeof numbersRaw === "string"
            ? BigInt(numbersRaw)
            : BigInt(Math.trunc(numbersRaw as number)),
        timestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeRouletteBetHistory(rolls: RouletteRollResult[]): string {
  return JSON.stringify(
    rolls.map((r) => ({
      id: r.id.toString(),
      rolled: [...r.rolled],
      payout: r.payout.toString(),
      totalBetAmount: r.totalBetAmount.toString(),
      numbers: r.numbers.toString(),
      timestamp: r.timestamp,
    })),
  );
}

function mergeRouletteBetHistoryById(
  existing: RouletteRollResult[],
  incoming: RouletteRollResult[],
): RouletteRollResult[] {
  const byId = new Map<string, RouletteRollResult>();
  for (const r of [...existing, ...incoming]) {
    const id = r.id.toString();
    const prev = byId.get(id);
    byId.set(id, !prev || r.timestamp >= prev.timestamp ? r : prev);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BET_HISTORY);
}

function rouletteRollFromDecodedLog(
  args: {
    id?: bigint;
    rolled?: readonly number[];
    payout?: bigint;
    totalBetAmount?: bigint;
    numbers?: bigint;
  },
  log: { blockNumber?: bigint | null; logIndex?: number | null },
): RouletteRollResult | null {
  if (!args.rolled || args.rolled.length === 0) return null;
  const ts = Number(rollSortKeyFromLog(log));
  return {
    id: args.id ?? BigInt(0),
    rolled: args.rolled,
    payout: args.payout ?? BigInt(0),
    totalBetAmount: args.totalBetAmount ?? BigInt(0),
    numbers: args.numbers ?? BigInt(0),
    timestamp: ts,
  };
}

const kenoBetHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `keno.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

export interface KenoRollResult {
  id: bigint;
  /** Drawn numbers (on-chain uint40 values). */
  rolled: readonly number[];
  payout: bigint;
  totalBetAmount: bigint;
  /** Player selection encoded as uint40. */
  numbers: bigint;
  timestamp: number;
}

function parseStoredKenoBetHistory(raw: string | null): KenoRollResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: KenoRollResult[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o.id;
      const payout = o.payout;
      const totalBetAmount = o.totalBetAmount;
      const rolled = o.rolled;
      const numbersRaw = o.numbers;
      const timestamp = o.timestamp;
      if (typeof id !== "string" || typeof payout !== "string" || typeof totalBetAmount !== "string")
        continue;
      if (!Array.isArray(rolled) || rolled.some((x) => typeof x !== "number")) continue;
      if (
        (typeof numbersRaw !== "string" && typeof numbersRaw !== "number") ||
        typeof timestamp !== "number"
      )
        continue;
      out.push({
        id: BigInt(id),
        rolled: rolled as number[],
        payout: BigInt(payout),
        totalBetAmount: BigInt(totalBetAmount),
        numbers:
          typeof numbersRaw === "string"
            ? BigInt(numbersRaw)
            : BigInt(Math.trunc(numbersRaw as number)),
        timestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeKenoBetHistory(rolls: KenoRollResult[]): string {
  return JSON.stringify(
    rolls.map((r) => ({
      id: r.id.toString(),
      rolled: [...r.rolled],
      payout: r.payout.toString(),
      totalBetAmount: r.totalBetAmount.toString(),
      numbers: r.numbers.toString(),
      timestamp: r.timestamp,
    })),
  );
}

function mergeKenoBetHistoryById(
  existing: KenoRollResult[],
  incoming: KenoRollResult[],
): KenoRollResult[] {
  const byId = new Map<string, KenoRollResult>();
  for (const r of [...existing, ...incoming]) {
    const id = r.id.toString();
    const prev = byId.get(id);
    byId.set(id, !prev || r.timestamp >= prev.timestamp ? r : prev);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BET_HISTORY);
}

function kenoRollFromDecodedLog(
  args: {
    id?: bigint;
    rolled?: readonly number[];
    payout?: bigint;
    totalBetAmount?: bigint;
    numbers?: bigint;
  },
  log: { blockNumber?: bigint | null; logIndex?: number | null },
): KenoRollResult | null {
  if (!args.rolled || args.rolled.length === 0) return null;
  const ts = Number(rollSortKeyFromLog(log));
  return {
    id: args.id ?? BigInt(0),
    rolled: args.rolled,
    payout: args.payout ?? BigInt(0),
    totalBetAmount: args.totalBetAmount ?? BigInt(0),
    numbers: args.numbers ?? BigInt(0),
    timestamp: ts,
  };
}

const wheelBetHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `wheel.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

const plinkoBetHistoryStorageKey = (chainId: number, wallet: `0x${string}`) =>
  `plinko.betHistory.v1:${chainId}:${wallet.toLowerCase()}`;

export interface WheelRollResult {
  id: bigint;
  /** Segment indices from the `Roll` event (`uint8[]`). */
  rolled: readonly number[];
  payout: bigint;
  totalBetAmount: bigint;
  configId: number;
  timestamp: number;
}

function parseStoredWheelBetHistory(raw: string | null): WheelRollResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: WheelRollResult[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o.id;
      const payout = o.payout;
      const totalBetAmount = o.totalBetAmount;
      const rolled = o.rolled;
      const configId = o.configId;
      const timestamp = o.timestamp;
      if (typeof id !== "string" || typeof payout !== "string" || typeof totalBetAmount !== "string")
        continue;
      if (!Array.isArray(rolled) || rolled.some((x) => typeof x !== "number")) continue;
      if (typeof configId !== "number" || typeof timestamp !== "number") continue;
      out.push({
        id: BigInt(id),
        rolled: rolled as number[],
        payout: BigInt(payout),
        totalBetAmount: BigInt(totalBetAmount),
        configId,
        timestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeWheelBetHistory(rolls: WheelRollResult[]): string {
  return JSON.stringify(
    rolls.map((r) => ({
      id: r.id.toString(),
      rolled: [...r.rolled],
      payout: r.payout.toString(),
      totalBetAmount: r.totalBetAmount.toString(),
      configId: r.configId,
      timestamp: r.timestamp,
    })),
  );
}

function mergeWheelBetHistoryById(
  existing: WheelRollResult[],
  incoming: WheelRollResult[],
): WheelRollResult[] {
  const byId = new Map<string, WheelRollResult>();
  for (const r of [...existing, ...incoming]) {
    const id = r.id.toString();
    const prev = byId.get(id);
    byId.set(id, !prev || r.timestamp >= prev.timestamp ? r : prev);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BET_HISTORY);
}

function wheelRollFromDecodedLog(
  args: {
    id?: bigint;
    rolled?: readonly number[];
    payout?: bigint;
    totalBetAmount?: bigint;
    configId?: number;
  },
  log: { blockNumber?: bigint | null; logIndex?: number | null },
): WheelRollResult | null {
  if (!args.rolled || args.rolled.length === 0) return null;
  const ts = Number(rollSortKeyFromLog(log));
  return {
    id: args.id ?? BigInt(0),
    rolled: args.rolled,
    payout: args.payout ?? BigInt(0),
    totalBetAmount: args.totalBetAmount ?? BigInt(0),
    configId: args.configId ?? 0,
    timestamp: ts,
  };
}

/**
 * Generic VRF cost fetcher. getChainlinkVRFCost uses tx.gasprice internally,
 * which is 0 in a normal eth_call, so we pass the current gasPrice explicitly.
 * Works for any game ABI that has getChainlinkVRFCost(address,uint16).
 */
async function fetchVrfCost(
  client: PublicClient,
  contractAddress: Address,
  callerAddress: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  tokenAddress: Address,
  betCount: number = 1,
): Promise<bigint> {
  const safeGasPrice = BigInt(1_000_000_000);
  const data = encodeFunctionData({
    abi,
    functionName: "getChainlinkVRFCost",
    args: [tokenAddress, betCount],
  });
  const result = await client.call({
    to: contractAddress,
    data,
    gasPrice: safeGasPrice,
    account: callerAddress,
    gas: BigInt(500_000),
  });
  if (!result.data) return BigInt(0);
  return decodeFunctionResult({
    abi,
    functionName: "getChainlinkVRFCost",
    data: result.data,
  }) as bigint;
}

/**
 * Coin toss game: reads and writes use the on-chain ABI in `@/lib/casino/abis/CoinToss`.
 * Accepts an optional betToken; defaults to the chain's default token.
 */
export function useCoinToss(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const token = useMemo(() => betToken ?? getDefaultBetToken(chainId), [betToken, chainId]);
  const coinToss = useMemo(() => getCasinoCoinTossAddress(chainId), [chainId]);
  const coinTossConfigured = isCasinoAddressConfigured(coinToss);
  const { address: connected } = useConnection();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = coinTossConfigured;

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
        const cost = await fetchVrfCost(
          publicClient as PublicClient,
          coinToss,
          connected!,
          coinTossAbi,
          token.address,
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
  }, [queryEnabled, publicClient, coinToss, connected, token.address]);

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
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [betHistory, setBetHistory] = useState<RollResult[]>([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setBetHistory([]);
      setBetHistoryLoading(false);
      setBetHistoryError(undefined);
      return;
    }
    const storageKey = betHistoryStorageKey(chainId, connected);
    const stored = parseStoredBetHistory(
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
    );
    if (stored.length > 0) {
      setBetHistory(stored);
    } else {
      setBetHistory([]);
    }

    let cancelled = false;
    setBetHistoryLoading(true);
    setBetHistoryError(undefined);

    async function loadFromChain() {
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          head > lookbackFor(chainId)
            ? head - lookbackFor(chainId)
            : BigInt(0);
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: coinToss,
          abi: coinTossAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: RollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = rollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly boolean[];
              payout?: bigint;
              totalBetAmount?: bigint;
              face?: boolean;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (cancelled) return;
        setBetHistory((prev) => mergeBetHistoryById(prev, rolls));
      } catch (e) {
        if (!cancelled) {
          setBetHistoryError(
            e instanceof Error ? e : new Error("Failed to load bet history"),
          );
        }
      } finally {
        if (!cancelled) setBetHistoryLoading(false);
      }
    }

    void loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [queryEnabled, publicClient, connected, coinToss, chainId]);

  useEffect(() => {
    if (typeof window === "undefined" || !connected) return;
    try {
      window.localStorage.setItem(
        betHistoryStorageKey(chainId, connected),
        serializeBetHistory(betHistory),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [betHistory, chainId, connected]);

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
      const roll: RollResult = {
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        face: args.face ?? false,
        timestamp: Date.now(),
      };
      setLastRoll(roll);
      setBetHistory((prev) => mergeBetHistoryById(prev, [roll]));
    },
  });

  const minBetAmount = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    const oneCent = BigInt(1);
    return oneCent;
  }, [vrfCost]);

  /**
   * Place a coin toss wager.
   * @param betHeads - true when the player chose heads in the UI, false for tails
   * @param betAmount - the amount to bet in the token's smallest unit
   *
   * On-chain `wager(bool face, ...)` uses BetSwirl semantics: `true` = Tails, `false` = Heads
   * (see `contracts/cointoss/contracts/pvh/CoinToss.sol`). The UI bool is inverted when calling.
   */
  const placeWager = useCallback(
    async (betHeads: boolean, betAmount: bigint): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }
      if (betAmount === BigInt(0)) {
        throw new Error("Bet amount must be greater than 0");
      }

      const vrf = await fetchVrfCost(
        publicClient as PublicClient,
        coinToss,
        connected,
        coinTossAbi,
        token.address,
      );

      const envAffiliate = process.env.NEXT_PUBLIC_CASINO_AFFILIATE;
      const affiliate: `0x${string}` =
        envAffiliate && isAddress(envAffiliate) ? envAffiliate : connected;

      if (!token.isNative) {
        await writeContractAsync({
          address: token.address,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [coinToss, betAmount],
        });
      }

      const vrfWithBuffer =
        vrf > BigInt(0) ? (vrf * BigInt(200)) / BigInt(100) : getMinVrfBudget(chainId);
      const msgValue = token.isNative ? betAmount + vrfWithBuffer : vrfWithBuffer;

      return writeContractAsync({
        address: coinToss,
        abi: coinTossAbi,
        functionName: "wager",
        args: [
          !betHeads,
          connected,
          affiliate,
          {
            token: token.address,
            betAmount,
            betCount: defaultCasinoGameParams.betCount,
            stopGain: defaultCasinoGameParams.stopGain,
            stopLoss: defaultCasinoGameParams.stopLoss,
            maxHouseEdge: MAX_HOUSE_EGDE,
          },
        ],
        value: msgValue,
      });
    },
    [coinToss, connected, publicClient, writeContractAsync, token, chainId],
  );

  const canWager = coinTossConfigured && paused === false;

  const refreshRolls = useCallback(
    async (fromBlock?: bigint) => {
      if (!publicClient || !connected || !coinTossConfigured) return;
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          fromBlock ??
          (head > lookbackFor(chainId) ? head - lookbackFor(chainId) : BigInt(0));
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: coinToss,
          abi: coinTossAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: RollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = rollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly boolean[];
              payout?: bigint;
              totalBetAmount?: bigint;
              face?: boolean;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (rolls.length === 0) return;
        setBetHistory((prev) => mergeBetHistoryById(prev, rolls));
        const latest = rolls.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
        setLastRoll((prev) => (prev && prev.id === latest.id ? prev : latest));
      } catch (e) {
        if (typeof window !== "undefined") {
          console.warn("[casino] refreshRolls RPC error:", e);
        }
      }
    },
    [publicClient, connected, coinTossConfigured, coinToss, chainId],
  );

  return {
    coinTossAddress: coinToss,
    coinTossConfigured,
    betToken: token,
    vrfCost,
    chainTokenConfig,
    paused,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    data: minBetAmount,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}

/**
 * Dice game: reads and writes use the on-chain ABI in `@/lib/casino/abis/Dice`.
 */
export function useDice(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const token = useMemo(() => betToken ?? getDefaultBetToken(chainId), [betToken, chainId]);
  const dice = useMemo(() => getCasinoDiceAddress(chainId), [chainId]);
  const diceConfigured = isCasinoAddressConfigured(dice);
  const { address: connected } = useConnection();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = diceConfigured;

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
        const cost = await fetchVrfCost(
          publicClient as PublicClient,
          dice,
          connected!,
          diceAbi,
          token.address,
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
  }, [queryEnabled, publicClient, dice, connected, token.address]);

  const { data: paused } = useReadContract({
    address: dice,
    abi: diceAbi,
    functionName: "paused",
    query: { enabled: queryEnabled },
  });

  const { data: chainTokenConfig } = useReadContract({
    address: dice,
    abi: diceAbi,
    functionName: "tokens",
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null);
  const [betHistory, setBetHistory] = useState<DiceRollResult[]>([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setBetHistory([]);
      setBetHistoryLoading(false);
      setBetHistoryError(undefined);
      return;
    }
    const storageKey = diceBetHistoryStorageKey(chainId, connected);
    const stored = parseStoredDiceBetHistory(
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
    );
    if (stored.length > 0) {
      setBetHistory(stored);
    } else {
      setBetHistory([]);
    }

    let cancelled = false;
    setBetHistoryLoading(true);
    setBetHistoryError(undefined);

    async function loadFromChain() {
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          head > lookbackFor(chainId)
            ? head - lookbackFor(chainId)
            : BigInt(0);
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: dice,
          abi: diceAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: DiceRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = diceRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              cap?: number;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (cancelled) return;
        setBetHistory((prev) => mergeDiceBetHistoryById(prev, rolls));
      } catch (e) {
        if (!cancelled) {
          setBetHistoryError(
            e instanceof Error ? e : new Error("Failed to load bet history"),
          );
        }
      } finally {
        if (!cancelled) setBetHistoryLoading(false);
      }
    }

    void loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [queryEnabled, publicClient, connected, dice, chainId]);

  useEffect(() => {
    if (typeof window === "undefined" || !connected) return;
    try {
      window.localStorage.setItem(
        diceBetHistoryStorageKey(chainId, connected),
        serializeDiceBetHistory(betHistory),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [betHistory, chainId, connected]);

  useWatchContractEvent({
    address: dice,
    abi: diceAbi,
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
        rolled?: readonly number[];
        payout?: bigint;
        totalBetAmount?: bigint;
        cap?: number;
      };
      if (!args.rolled || args.rolled.length === 0) return;
      const roll: DiceRollResult = {
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        cap: args.cap ?? 0,
        timestamp: Date.now(),
      };
      setLastRoll(roll);
      setBetHistory((prev) => mergeDiceBetHistoryById(prev, [roll]));
    },
  });

  const minTotal = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    return BigInt(1);
  }, [vrfCost]);

  const placeWager = useCallback(
    async (cap: number, betAmount: bigint): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }
      if (betAmount === BigInt(0)) {
        throw new Error("Bet amount must be greater than 0");
      }

      const vrf = await fetchVrfCost(
        publicClient as PublicClient,
        dice,
        connected,
        diceAbi,
        token.address,
      );

      const envAffiliate = process.env.NEXT_PUBLIC_CASINO_AFFILIATE;
      const affiliate: `0x${string}` =
        envAffiliate && isAddress(envAffiliate) ? envAffiliate : connected;

      if (!token.isNative) {
        await writeContractAsync({
          address: token.address,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [dice, betAmount],
        });
      }

      const vrfWithBuffer =
        vrf > BigInt(0) ? (vrf * BigInt(200)) / BigInt(100) : getMinVrfBudget(chainId);
      const msgValue = token.isNative ? betAmount + vrfWithBuffer : vrfWithBuffer;

      return writeContractAsync({
        address: dice,
        abi: diceAbi,
        functionName: "wager",
        args: [
          cap,
          connected,
          affiliate,
          {
            token: token.address,
            betAmount,
            betCount: defaultCasinoGameParams.betCount,
            stopGain: defaultCasinoGameParams.stopGain,
            stopLoss: defaultCasinoGameParams.stopLoss,
            maxHouseEdge: MAX_HOUSE_EGDE,
          },
        ],
        value: msgValue,
      });
    },
    [dice, connected, publicClient, writeContractAsync, token, chainId],
  );

  const canWager = diceConfigured && paused === false;

  const refreshRolls = useCallback(
    async (fromBlock?: bigint) => {
      if (!publicClient || !connected || !diceConfigured) return;
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          fromBlock ??
          (head > lookbackFor(chainId) ? head - lookbackFor(chainId) : BigInt(0));
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: dice,
          abi: diceAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: DiceRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = diceRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              cap?: number;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (rolls.length === 0) return;
        setBetHistory((prev) => mergeDiceBetHistoryById(prev, rolls));
        const latest = rolls.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
        setLastRoll((prev) => (prev && prev.id === latest.id ? prev : latest));
      } catch (e) {
        if (typeof window !== "undefined") {
          console.warn("[casino] refreshRolls RPC error:", e);
        }
      }
    },
    [publicClient, connected, diceConfigured, dice, chainId],
  );

  return {
    diceAddress: dice,
    diceConfigured,
    betToken: token,
    vrfCost,
    chainTokenConfig,
    paused,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    data: minTotal,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}

/** BetData tuple passed to `wager` on the Roulette contract (matches `IGamePlayer.BetData`). */
export type RouletteBetData = {
  token: `0x${string}`;
  betAmount: bigint;
  betCount: number;
  stopGain: bigint;
  stopLoss: bigint;
  maxHouseEdge: number;
};

/**
 * Roulette game: reads and writes use the on-chain ABI in `@/lib/casino/abis/Roulette`.
 */
export function useRoulette(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const token = useMemo(() => betToken ?? getDefaultBetToken(chainId), [betToken, chainId]);
  const roulette = useMemo(() => getCasinoRouletteAddress(chainId), [chainId]);
  const rouletteConfigured = isCasinoAddressConfigured(roulette);
  const { address: connected } = useConnection();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = rouletteConfigured;

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
        const cost = await fetchVrfCost(
          publicClient as PublicClient,
          roulette,
          connected!,
          rouletteAbi,
          token.address,
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
  }, [queryEnabled, publicClient, roulette, connected, token.address]);

  const { data: paused } = useReadContract({
    address: roulette,
    abi: rouletteAbi,
    functionName: "paused",
    query: { enabled: queryEnabled },
  });

  const { data: chainTokenConfig } = useReadContract({
    address: roulette,
    abi: rouletteAbi,
    functionName: "tokens",
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const [lastRoll, setLastRoll] = useState<RouletteRollResult | null>(null);
  const [betHistory, setBetHistory] = useState<RouletteRollResult[]>([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setBetHistory([]);
      setBetHistoryLoading(false);
      setBetHistoryError(undefined);
      return;
    }
    const storageKey = rouletteBetHistoryStorageKey(chainId, connected);
    const stored = parseStoredRouletteBetHistory(
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
    );
    if (stored.length > 0) {
      setBetHistory(stored);
    } else {
      setBetHistory([]);
    }

    let cancelled = false;
    setBetHistoryLoading(true);
    setBetHistoryError(undefined);

    async function loadFromChain() {
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          head > lookbackFor(chainId)
            ? head - lookbackFor(chainId)
            : BigInt(0);
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: roulette,
          abi: rouletteAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: RouletteRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = rouletteRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              numbers?: bigint;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (cancelled) return;
        setBetHistory((prev) => mergeRouletteBetHistoryById(prev, rolls));
      } catch (e) {
        if (!cancelled) {
          setBetHistoryError(
            e instanceof Error ? e : new Error("Failed to load bet history"),
          );
        }
      } finally {
        if (!cancelled) setBetHistoryLoading(false);
      }
    }

    void loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [queryEnabled, publicClient, connected, roulette, chainId]);

  useEffect(() => {
    if (typeof window === "undefined" || !connected) return;
    try {
      window.localStorage.setItem(
        rouletteBetHistoryStorageKey(chainId, connected),
        serializeRouletteBetHistory(betHistory),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [betHistory, chainId, connected]);

  useWatchContractEvent({
    address: roulette,
    abi: rouletteAbi,
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
        rolled?: readonly number[];
        payout?: bigint;
        totalBetAmount?: bigint;
        numbers?: bigint;
      };
      if (!args.rolled || args.rolled.length === 0) return;
      const roll: RouletteRollResult = {
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        numbers: args.numbers ?? BigInt(0),
        timestamp: Date.now(),
      };
      setLastRoll(roll);
      setBetHistory((prev) => mergeRouletteBetHistoryById(prev, [roll]));
    },
  });

  const minTotal = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    return BigInt(1);
  }, [vrfCost]);

  const placeWager = useCallback(
    async (
      encodedNumbers: bigint,
      receiver: `0x${string}`,
      affiliate: `0x${string}`,
      betData: RouletteBetData,
    ): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }

      const vrf = await fetchVrfCost(
        publicClient as PublicClient,
        roulette,
        connected,
        rouletteAbi,
        token.address,
      );

      if (!token.isNative) {
        await writeContractAsync({
          address: token.address,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [roulette, betData.betAmount],
        });
      }

      const vrfWithBuffer =
        vrf > BigInt(0) ? (vrf * BigInt(200)) / BigInt(100) : getMinVrfBudget(chainId);
      const msgValue = token.isNative ? betData.betAmount + vrfWithBuffer : vrfWithBuffer;

      return writeContractAsync({
        address: roulette,
        abi: rouletteAbi,
        functionName: "wager",
        args: [encodedNumbers, receiver, affiliate, betData],
        value: msgValue,
      });
    },
    [roulette, connected, publicClient, writeContractAsync, token, chainId],
  );

  const canWager = rouletteConfigured && paused === false;

  const refreshRolls = useCallback(
    async (fromBlock?: bigint) => {
      if (!publicClient || !connected || !rouletteConfigured) return;
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          fromBlock ??
          (head > lookbackFor(chainId) ? head - lookbackFor(chainId) : BigInt(0));
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: roulette,
          abi: rouletteAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: RouletteRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = rouletteRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              numbers?: bigint;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (rolls.length === 0) return;
        setBetHistory((prev) => mergeRouletteBetHistoryById(prev, rolls));
        const latest = rolls.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
        setLastRoll((prev) => (prev && prev.id === latest.id ? prev : latest));
      } catch (e) {
        if (typeof window !== "undefined") {
          console.warn("[casino] refreshRolls RPC error:", e);
        }
      }
    },
    [publicClient, connected, rouletteConfigured, roulette, chainId],
  );

  return {
    rouletteAddress: roulette,
    rouletteConfigured,
    betToken: token,
    vrfCost,
    chainTokenConfig,
    paused,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    data: minTotal,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}

/** BetData tuple passed to `wager` on the Keno contract (matches `IGamePlayer.BetData`). */
export type KenoBetData = {
  token: `0x${string}`;
  betAmount: bigint;
  betCount: number;
  stopGain: bigint;
  stopLoss: bigint;
  maxHouseEdge: number;
};

/**
 * Keno game: reads payout table via `gains`, writes via `wager` on `@/lib/casino/abis/Keno`.
 */
export function useKeno(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const token = useMemo(() => betToken ?? getDefaultBetToken(chainId), [betToken, chainId]);
  const keno = useMemo(() => getCasinoKenoAddress(chainId), [chainId]);
  const kenoConfigured = isCasinoAddressConfigured(keno);
  const { address: connected } = useConnection();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = kenoConfigured;

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
        const cost = await fetchVrfCost(
          publicClient as PublicClient,
          keno,
          connected!,
          kenoAbi,
          token.address,
          defaultCasinoGameParams.betCount,
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
  }, [queryEnabled, publicClient, keno, connected, token.address]);

  const { data: paused } = useReadContract({
    address: keno,
    abi: kenoAbi,
    functionName: "paused",
    query: { enabled: queryEnabled },
  });

  const { data: chainTokenConfig } = useReadContract({
    address: keno,
    abi: kenoAbi,
    functionName: "tokens",
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const { data: kenoConfig } = useReadContract({
    address: keno,
    abi: kenoAbi,
    functionName: "gains",
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const [lastRoll, setLastRoll] = useState<KenoRollResult | null>(null);
  const [betHistory, setBetHistory] = useState<KenoRollResult[]>([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setBetHistory([]);
      setBetHistoryLoading(false);
      setBetHistoryError(undefined);
      return;
    }
    const storageKey = kenoBetHistoryStorageKey(chainId, connected);
    const stored = parseStoredKenoBetHistory(
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
    );
    if (stored.length > 0) {
      setBetHistory(stored);
    } else {
      setBetHistory([]);
    }

    let cancelled = false;
    setBetHistoryLoading(true);
    setBetHistoryError(undefined);

    async function loadFromChain() {
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          head > lookbackFor(chainId)
            ? head - lookbackFor(chainId)
            : BigInt(0);
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: keno,
          abi: kenoAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: KenoRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = kenoRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              numbers?: bigint;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (cancelled) return;
        setBetHistory((prev) => mergeKenoBetHistoryById(prev, rolls));
      } catch (e) {
        if (!cancelled) {
          setBetHistoryError(
            e instanceof Error ? e : new Error("Failed to load bet history"),
          );
        }
      } finally {
        if (!cancelled) setBetHistoryLoading(false);
      }
    }

    void loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [queryEnabled, publicClient, connected, keno, chainId]);

  useEffect(() => {
    if (typeof window === "undefined" || !connected) return;
    try {
      window.localStorage.setItem(
        kenoBetHistoryStorageKey(chainId, connected),
        serializeKenoBetHistory(betHistory),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [betHistory, chainId, connected]);

  useWatchContractEvent({
    address: keno,
    abi: kenoAbi,
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
        rolled?: readonly number[];
        payout?: bigint;
        totalBetAmount?: bigint;
        numbers?: bigint;
      };
      if (!args.rolled || args.rolled.length === 0) return;
      const roll: KenoRollResult = {
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        numbers: args.numbers ?? BigInt(0),
        timestamp: Date.now(),
      };
      setLastRoll(roll);
      setBetHistory((prev) => mergeKenoBetHistoryById(prev, [roll]));
    },
  });

  const minTotal = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    return BigInt(1);
  }, [vrfCost]);

  const placeWager = useCallback(
    async (
      encodedNumbers: bigint,
      receiver: `0x${string}`,
      affiliate: `0x${string}`,
      betData: KenoBetData,
    ): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }

      const vrf = await fetchVrfCost(
        publicClient as PublicClient,
        keno,
        connected,
        kenoAbi,
        token.address,
        betData.betCount,
      );

      if (!token.isNative) {
        await writeContractAsync({
          address: token.address,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [keno, betData.betAmount],
        });
      }

      const vrfWithBuffer =
        vrf > BigInt(0) ? (vrf * BigInt(200)) / BigInt(100) : getMinVrfBudget(chainId);
      const msgValue = token.isNative ? betData.betAmount + vrfWithBuffer : vrfWithBuffer;

      return writeContractAsync({
        address: keno,
        abi: kenoAbi,
        functionName: "wager",
        args: [encodedNumbers, receiver, affiliate, betData],
        value: msgValue,
      });
    },
    [keno, connected, publicClient, writeContractAsync, token, chainId],
  );

  const canWager = kenoConfigured && paused === false;

  const refreshRolls = useCallback(
    async (fromBlock?: bigint) => {
      if (!publicClient || !connected || !kenoConfigured) return;
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          fromBlock ??
          (head > lookbackFor(chainId) ? head - lookbackFor(chainId) : BigInt(0));
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: keno,
          abi: kenoAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: KenoRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = kenoRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              numbers?: bigint;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (rolls.length === 0) return;
        setBetHistory((prev) => mergeKenoBetHistoryById(prev, rolls));
        const latest = rolls.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
        setLastRoll((prev) => (prev && prev.id === latest.id ? prev : latest));
      } catch (e) {
        if (typeof window !== "undefined") {
          console.warn("[casino] refreshRolls RPC error:", e);
        }
      }
    },
    [publicClient, connected, kenoConfigured, keno, chainId],
  );

  return {
    kenoAddress: keno,
    kenoConfigured,
    betToken: token,
    vrfCost,
    chainTokenConfig,
    kenoConfig,
    paused,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    data: minTotal,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}

/** BetData tuple passed to `wager` on the Wheel contract (matches `IGamePlayer.BetData`). */
export type WheelBetData = {
  token: `0x${string}`;
  betAmount: bigint;
  betCount: number;
  stopGain: bigint;
  stopLoss: bigint;
  maxHouseEdge: number;
};

type WeightedWheelLikeHistoryKey = (chainId: number, wallet: `0x${string}`) => string;

/**
 * Shared logic for weighted games that use the same on-chain `Wheel` ABI (wheel + plinko contracts).
 */
function useWeightedWheelLikeGame(
  game: `0x${string}`,
  gameConfigured: boolean,
  historyStorageKey: WeightedWheelLikeHistoryKey,
  betTokenOverride?: BetToken,
) {
  const chainId = useWalletChainId();
  const token = useMemo(() => betTokenOverride ?? getDefaultBetToken(chainId), [betTokenOverride, chainId]);
  const { address: connected } = useConnection();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: _writeData,
    isPending: writePending,
    ...writeRest
  } = useWriteContract();

  const queryEnabled = gameConfigured;

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
        const cost = await fetchVrfCost(
          publicClient as PublicClient,
          game,
          connected!,
          wheelAbi,
          token.address,
          defaultCasinoGameParams.betCount,
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
  }, [queryEnabled, publicClient, game, connected, token.address]);

  const { data: paused } = useReadContract({
    address: game,
    abi: wheelAbi,
    functionName: "paused",
    query: { enabled: queryEnabled },
  });

  const { data: chainTokenConfig } = useReadContract({
    address: game,
    abi: wheelAbi,
    functionName: "tokens",
    args: [token.address],
    query: { enabled: queryEnabled },
  });

  const { data: configsCountRaw } = useReadContract({
    address: game,
    abi: wheelAbi,
    functionName: "configsCount",
    query: { enabled: queryEnabled },
  });

  const configsCount =
    typeof configsCountRaw === "bigint"
      ? Number(configsCountRaw)
      : typeof configsCountRaw === "number"
        ? configsCountRaw
        : 0;

  const gameConfigContracts = useMemo(() => {
    if (!gameConfigured || configsCount <= 0) return [];
    return Array.from({ length: configsCount }, (_, i) => ({
      address: game,
      abi: wheelAbi,
      functionName: "gameConfigs" as const,
      args: [i] as const,
    }));
  }, [game, gameConfigured, configsCount]);

  const { data: gameConfigsRaw, isPending: gameConfigsLoading } = useReadContracts({
    contracts: gameConfigContracts,
    query: {
      enabled: queryEnabled && configsCount > 0 && gameConfigContracts.length > 0,
      select: (results) => {
        const casinoChainId = chainId as CasinoChainId;
        const parsed: WeightedGameConfiguration[] = [];
        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          if (row.status !== "success" || row.result == null) continue;
          const tuple = row.result as readonly [
            readonly bigint[],
            readonly bigint[],
            bigint,
            number,
          ];
          const raw = {
            weightRanges: [...tuple[0]],
            multipliers: [...tuple[1]],
            maxMultiplier: tuple[2],
            gameId: tuple[3],
          };
          try {
            parsed.push(parseRawWeightedGameConfiguration(raw, i, casinoChainId));
          } catch {
            // skip malformed rows
          }
        }
        return parsed;
      },
    },
  });

  const gameConfigs = gameConfigsRaw ?? [];

  const [lastRoll, setLastRoll] = useState<WheelRollResult | null>(null);
  const [betHistory, setBetHistory] = useState<WheelRollResult[]>([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!queryEnabled || !publicClient || !connected) {
      setBetHistory([]);
      setBetHistoryLoading(false);
      setBetHistoryError(undefined);
      return;
    }
    const storageKey = historyStorageKey(chainId, connected);
    const stored = parseStoredWheelBetHistory(
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
    );
    if (stored.length > 0) {
      setBetHistory(stored);
    } else {
      setBetHistory([]);
    }

    let cancelled = false;
    setBetHistoryLoading(true);
    setBetHistoryError(undefined);

    async function loadFromChain() {
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          head > lookbackFor(chainId)
            ? head - lookbackFor(chainId)
            : BigInt(0);
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: game,
          abi: wheelAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: WheelRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = wheelRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              configId?: number;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (cancelled) return;
        setBetHistory((prev) => mergeWheelBetHistoryById(prev, rolls));
      } catch (e) {
        if (!cancelled) {
          setBetHistoryError(
            e instanceof Error ? e : new Error("Failed to load bet history"),
          );
        }
      } finally {
        if (!cancelled) setBetHistoryLoading(false);
      }
    }

    void loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [queryEnabled, publicClient, connected, game, chainId, historyStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !connected) return;
    try {
      window.localStorage.setItem(
        historyStorageKey(chainId, connected),
        serializeWheelBetHistory(betHistory),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [betHistory, chainId, connected, historyStorageKey]);

  useWatchContractEvent({
    address: game,
    abi: wheelAbi,
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
        rolled?: readonly number[];
        payout?: bigint;
        totalBetAmount?: bigint;
        configId?: number;
      };
      if (!args.rolled || args.rolled.length === 0) return;
      const roll: WheelRollResult = {
        id: args.id ?? BigInt(0),
        rolled: args.rolled,
        payout: args.payout ?? BigInt(0),
        totalBetAmount: args.totalBetAmount ?? BigInt(0),
        configId: args.configId ?? 0,
        timestamp: Date.now(),
      };
      setLastRoll(roll);
      setBetHistory((prev) => mergeWheelBetHistoryById(prev, [roll]));
    },
  });

  const minTotal = useMemo(() => {
    if (typeof vrfCost !== "bigint") return undefined;
    return BigInt(1);
  }, [vrfCost]);

  const placeWager = useCallback(
    async (
      configId: number,
      receiver: `0x${string}`,
      affiliate: `0x${string}`,
      betData: WheelBetData,
    ): Promise<CasinoTxHash> => {
      if (!publicClient || !connected) {
        throw new Error("Wallet not connected");
      }

      const vrf = await fetchVrfCost(
        publicClient as PublicClient,
        game,
        connected,
        wheelAbi,
        token.address,
        betData.betCount,
      );

      if (!token.isNative) {
        await writeContractAsync({
          address: token.address,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [game, betData.betAmount],
        });
      }

      const vrfWithBuffer =
        vrf > BigInt(0) ? (vrf * BigInt(200)) / BigInt(100) : getMinVrfBudget(chainId);
      const msgValue = token.isNative ? betData.betAmount + vrfWithBuffer : vrfWithBuffer;

      return writeContractAsync({
        address: game,
        abi: wheelAbi,
        functionName: "wager",
        args: [configId, receiver, affiliate, betData],
        value: msgValue,
      });
    },
    [game, connected, publicClient, writeContractAsync, token, chainId],
  );

  const canWager = gameConfigured && paused === false;

  const refreshRolls = useCallback(
    async (fromBlock?: bigint) => {
      if (!publicClient || !connected || !gameConfigured) return;
      try {
        const head = await getBlockNumber(publicClient as PublicClient);
        const from =
          fromBlock ??
          (head > lookbackFor(chainId) ? head - lookbackFor(chainId) : BigInt(0));
        const logs = await getContractEventsChunked(publicClient as PublicClient, {
          address: game,
          abi: wheelAbi,
          eventName: "Roll",
          args: { receiver: connected },
          fromBlock: from,
          toBlock: head,
        });
        const rolls: WheelRollResult[] = [];
        for (const log of logs) {
          if (!("args" in log) || !log.args || typeof log.args !== "object") continue;
          const r = wheelRollFromDecodedLog(
            log.args as {
              id?: bigint;
              rolled?: readonly number[];
              payout?: bigint;
              totalBetAmount?: bigint;
              configId?: number;
            },
            log,
          );
          if (r) rolls.push(r);
        }
        if (rolls.length === 0) return;
        setBetHistory((prev) => mergeWheelBetHistoryById(prev, rolls));
        const latest = rolls.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
        setLastRoll((prev) => (prev && prev.id === latest.id ? prev : latest));
      } catch (e) {
        if (typeof window !== "undefined") {
          console.warn("[casino] refreshRolls RPC error:", e);
        }
      }
    },
    [publicClient, connected, gameConfigured, game, chainId],
  );

  return {
    gameAddress: game,
    gameConfigured,
    betToken: token,
    vrfCost,
    chainTokenConfig,
    gameConfigs,
    gameConfigsLoading,
    paused,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    data: minTotal,
    isMinBetPending: vrfPending,
    isPending: writePending,
    placeWager,
    canWager,
    ...writeRest,
  };
}

/**
 * Wheel game: loads segment configs via `configsCount` / `gameConfigs`, writes via `wager` on `@/lib/casino/abis/Wheel`.
 */
export function useWheel(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const wheel = useMemo(() => getCasinoWheelAddress(chainId), [chainId]);
  const wheelConfigured = isCasinoAddressConfigured(wheel);
  const {
    gameAddress: wheelAddress,
    gameConfigured: wheelConfiguredOut,
    gameConfigs: wheelConfigs,
    gameConfigsLoading: wheelConfigsLoading,
    ...rest
  } = useWeightedWheelLikeGame(wheel, wheelConfigured, wheelBetHistoryStorageKey, betToken);
  return {
    wheelAddress,
    wheelConfigured: wheelConfiguredOut,
    wheelConfigs,
    wheelConfigsLoading,
    ...rest,
  };
}

export function usePlinko(betToken?: BetToken) {
  const chainId = useWalletChainId();
  const plinko = useMemo(() => getCasinoPlinkoAddress(chainId), [chainId]);
  const plinkoConfigured = isCasinoAddressConfigured(plinko);
  const {
    gameAddress: plinkoAddress,
    gameConfigured: plinkoConfiguredOut,
    gameConfigs: plinkoConfigs,
    gameConfigsLoading: plinkoConfigsLoading,
    ...rest
  } = useWeightedWheelLikeGame(plinko, plinkoConfigured, plinkoBetHistoryStorageKey, betToken);
  return {
    plinkoAddress,
    plinkoConfigured: plinkoConfiguredOut,
    plinkoConfigs,
    plinkoConfigsLoading,
    ...rest,
  };
}
