"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useWalletChainId } from "@/lib/useWalletChainId";
import type { PublicClient } from "viem";
import { getBlockNumber, getContractEvents } from "viem/actions";
import { coinTossAbi } from "@/lib/casino/abis/CoinToss";
import { diceAbi } from "@/lib/casino/abis/Dice";
import { kenoAbi } from "@/lib/casino/abis/Keno";
import { rouletteAbi } from "@/lib/casino/abis/Roulette";
import { wheelAbi } from "@/lib/casino/abis/Wheel";
import {
  PendingBetsCtx,
  type PendingBet,
  type PendingGameType,
} from "@/lib/casino/pendingBets";

const STORAGE_PREFIX = "eliesbets.pendingBets.v1";
const POLL_INTERVAL_MS = 5_000;
const STALL_AFTER_MS = 90_000;

const ABI_BY_GAME: Record<PendingGameType, typeof coinTossAbi> = {
  coinToss: coinTossAbi,
  dice: diceAbi as unknown as typeof coinTossAbi,
  roulette: rouletteAbi as unknown as typeof coinTossAbi,
  keno: kenoAbi as unknown as typeof coinTossAbi,
  wheel: wheelAbi as unknown as typeof coinTossAbi,
  plinko: wheelAbi as unknown as typeof coinTossAbi,
};

function storageKey(wallet: `0x${string}`) {
  return `${STORAGE_PREFIX}:${wallet.toLowerCase()}`;
}

function load(wallet?: `0x${string}`): PendingBet[] {
  if (!wallet || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is PendingBet =>
      x && typeof x === "object" && typeof x.id === "string"
    );
  } catch {
    return [];
  }
}

function save(wallet: `0x${string}`, bets: PendingBet[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(wallet), JSON.stringify(bets));
  } catch {
    // quota / private mode — ignore
  }
}

function randomId() {
  const arr = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function PendingBetsProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const chainId = useWalletChainId();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState<PendingBet[]>([]);
  const loadedFor = useRef<string | null>(null);

  // Load from localStorage when the wallet changes.
  useEffect(() => {
    if (!address) {
      setPending([]);
      loadedFor.current = null;
      return;
    }
    if (loadedFor.current === address.toLowerCase()) return;
    loadedFor.current = address.toLowerCase();
     
    setPending(load(address));
  }, [address]);

  // Persist.
  useEffect(() => {
    if (!address) return;
    save(address, pending);
  }, [address, pending]);

  const addPending = useCallback(
    (input: Omit<PendingBet, "status" | "placedAt" | "id"> & { id?: string; placedAt?: number }): string => {
      const id = input.id ?? randomId();
      const bet: PendingBet = {
        id,
        game: input.game,
        chainId: input.chainId,
        contract: input.contract,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        stakeWei: input.stakeWei,
        tokenSymbol: input.tokenSymbol,
        tokenDecimals: input.tokenDecimals,
        placedAt: input.placedAt ?? Date.now(),
        baselineRollId: input.baselineRollId,
        status: "pending",
      };
      setPending((prev) => {
        // De-dupe by txHash — if the same tx was added twice, update in place.
        const existing = prev.findIndex((b) => b.txHash.toLowerCase() === bet.txHash.toLowerCase());
        if (existing >= 0) {
          const next = prev.slice();
          next[existing] = { ...next[existing], ...bet, id: next[existing].id };
          return next;
        }
        return [bet, ...prev];
      });
      return id;
    },
    [],
  );

  const markBlock = useCallback((id: string, blockNumber: bigint) => {
    setPending((prev) =>
      prev.map((b) => (b.id === id ? { ...b, blockNumber: blockNumber.toString() } : b)),
    );
  }, []);

  const markStalled = useCallback((id: string) => {
    setPending((prev) =>
      prev.map((b) => (b.id === id && b.status === "pending" ? { ...b, status: "stalled" } : b)),
    );
  }, []);

  const resolve = useCallback((id: string, outcome: string, netWei: bigint) => {
    setPending((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "resolved", outcome, netWei: netWei.toString() } : b,
      ),
    );
    // Auto-dismiss resolved entries after 20s so the UI doesn't clutter.
    window.setTimeout(() => {
      setPending((prev) => prev.filter((b) => b.id !== id));
    }, 20_000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setPending((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clear = useCallback(() => setPending([]), []);

  // Watchdog: for each pending bet, poll for Roll events since the wager block
  // so the drawer resolves itself even when the user isn't on the game page.
  useEffect(() => {
    if (!publicClient || !address) return;
    const active = pending.filter((b) => b.status !== "resolved" && b.chainId === chainId);
    if (active.length === 0) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || !publicClient) return;
      let head: bigint;
      try {
        head = await getBlockNumber(publicClient as PublicClient);
      } catch {
        return;
      }
      for (const bet of active) {
        if (cancelled) return;
        const abi = ABI_BY_GAME[bet.game];
        const fromBlock = bet.blockNumber ? BigInt(bet.blockNumber) : head > 2_000n ? head - 2_000n : 0n;
        try {
          const logs = await getContractEvents(publicClient as PublicClient, {
            address: bet.contract,
            abi,
            eventName: "Roll",
            args: { receiver: address },
            fromBlock,
            toBlock: head,
          });
          if (logs.length === 0) continue;
          // Find a Roll with id != baseline (most recent one qualifies)
           
          const baseline = bet.baselineRollId ? BigInt(bet.baselineRollId) : null;
          const latest = logs[logs.length - 1];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const args = (latest as any).args as { id?: bigint; payout?: bigint; totalBetAmount?: bigint };
          if (args?.id == null) continue;
          if (baseline != null && args.id === baseline) continue;
          const payout = args.payout ?? 0n;
          const stake = args.totalBetAmount ?? 0n;
          const net = payout > 0n ? payout - stake : -stake;
          const outcome = payout > 0n ? "Won" : "Lost";
          resolve(bet.id, outcome, net);
        } catch {
          // RPC errors — tick again next interval
        }
      }
    }

    // Mark stalled bets based on wall-clock age (doesn't need RPC)
    const stallCheck = () => {
      const now = Date.now();
      for (const bet of active) {
        if (bet.status === "pending" && now - bet.placedAt > STALL_AFTER_MS) {
          markStalled(bet.id);
        }
      }
    };

    stallCheck();
    void tick();
    const pollId = window.setInterval(() => {
      stallCheck();
      void tick();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [publicClient, address, chainId, pending, resolve, markStalled]);

  const value = useMemo(
    () => ({ pending, addPending, markBlock, markStalled, resolve, dismiss, clear }),
    [pending, addPending, markBlock, markStalled, resolve, dismiss, clear],
  );

  return <PendingBetsCtx.Provider value={value}>{children}</PendingBetsCtx.Provider>;
}

