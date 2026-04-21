"use client";

import { BetType, useBets, useChain, type Bet } from "@azuro-org/sdk";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";

/** Matches `/bets` deep prefetch; warn in dev if a wallet exceeds this. */
export const MAX_SETTLED_PREFETCH_PAGES = 100;

export function settledPrefetchSessionKey(address: string, chainId: number) {
  return `eliesbets:prefetchedSettled:${address.toLowerCase()}:${chainId}`;
}

/** Call after claim-all so the next prefetch walk reloads every settled page. */
export function clearSettledPrefetchSessionFlag(
  address: string,
  chainId: number,
) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(settledPrefetchSessionKey(address, chainId));
}

export type SettledBetsPrefetchContextValue = {
  settledBets: Bet[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => ReturnType<ReturnType<typeof useBets>["fetchNextPage"]>;
  refetch: () => void;
  isPrefetchingAllSettled: boolean;
  settledPrefetchHitCap: boolean;
};

const SettledBetsPrefetchContext =
  createContext<SettledBetsPrefetchContextValue | null>(null);

export function useSettledBetsPrefetch(): SettledBetsPrefetchContextValue {
  const ctx = useContext(SettledBetsPrefetchContext);
  if (!ctx) {
    throw new Error("useSettledBetsPrefetch must be used within SettledBetsPrefetchProvider");
  }
  return ctx;
}

/**
 * Single `useBets(Settled)` owner + one-shot page walk so `/bets` and settlement toasts
 * do not race separate `fetchNextPage` loops (PRD §18).
 */
export function SettledBetsPrefetchProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useConnection();
  const { appChain } = useChain();
  const bettor = address ?? zeroAddress;
  const queryEnabled = Boolean(isConnected && address);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useBets({
    filter: { bettor, type: BetType.Settled },
    query: { enabled: queryEnabled },
  });

  const settledBets = useMemo(
    () => data?.pages.flatMap((p) => p.bets) ?? [],
    [data?.pages],
  );

  const prefetchGen = useRef(0);
  const [isPrefetchingAllSettled, setIsPrefetchingAllSettled] = useState(false);
  const [settledPrefetchHitCap, setSettledPrefetchHitCap] = useState(false);

  useEffect(() => {
    if (!queryEnabled || !address) {
      startTransition(() => {
        setIsPrefetchingAllSettled(false);
        setSettledPrefetchHitCap(false);
      });
      return;
    }
    const chainId = appChain.id;
    const key = settledPrefetchSessionKey(address, chainId);
    if (typeof window !== "undefined" && sessionStorage.getItem(key) === "1") {
      return;
    }

    const gen = ++prefetchGen.current;
    let cancelled = false;
    queueMicrotask(() => {
      setIsPrefetchingAllSettled(true);
      setSettledPrefetchHitCap(false);
    });

    (async () => {
      let hitCap = false;
      for (let i = 0; i < MAX_SETTLED_PREFETCH_PAGES && !cancelled; i++) {
        if (prefetchGen.current !== gen) return;
        const res = await fetchNextPage();
        if (!res?.hasNextPage) {
          break;
        }
        if (i === MAX_SETTLED_PREFETCH_PAGES - 1) {
          hitCap = true;
        }
      }
      if (cancelled || prefetchGen.current !== gen) return;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(key, "1");
      }
      if (hitCap && process.env.NODE_ENV === "development") {
        console.warn(
          "[SettledBetsPrefetchProvider] hit MAX_SETTLED_PREFETCH_PAGES; claim totals may be incomplete until manual paging.",
        );
      }
      queueMicrotask(() => {
        setSettledPrefetchHitCap(hitCap);
        setIsPrefetchingAllSettled(false);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [queryEnabled, address, appChain.id, fetchNextPage]);

  const value = useMemo<SettledBetsPrefetchContextValue>(
    () => ({
      settledBets,
      hasNextPage: Boolean(hasNextPage),
      isFetchingNextPage: Boolean(isFetchingNextPage),
      fetchNextPage,
      refetch,
      isPrefetchingAllSettled,
      settledPrefetchHitCap,
    }),
    [
      settledBets,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      refetch,
      isPrefetchingAllSettled,
      settledPrefetchHitCap,
    ],
  );

  return (
    <SettledBetsPrefetchContext.Provider value={value}>
      {children}
    </SettledBetsPrefetchContext.Provider>
  );
}
