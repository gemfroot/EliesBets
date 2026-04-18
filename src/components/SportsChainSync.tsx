"use client";

import { useChain } from "@azuro-org/sdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useConnection, useChainId } from "wagmi";
import { isValidSportsChainId } from "@/lib/sportsChainConstants";

const REFRESH_DEBOUNCE_MS = 120;

/**
 * Single place for wagmi chain → Azuro `appChainId` + RSC refresh (`Header` only calls
 * `switchChainAsync`; this runs after `chainId` updates).
 * Cold load: wallet chain can disagree with cookie — one refresh is intentional.
 *
 * Guard uses a ref so we don’t list `appChain.id` in the effect deps (that would run
 * cleanup after `setAppChainId` and cancel a pending `router.refresh()`).
 */
export function SportsChainSync() {
  const router = useRouter();
  const { isConnected } = useConnection();
  const chainId = useChainId();
  const { appChain, setAppChainId } = useChain();
  const appChainIdRef = useRef(appChain.id);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    appChainIdRef.current = appChain.id;
  }, [appChain.id]);

  useEffect(() => {
    if (!isConnected) return;
    if (!isValidSportsChainId(chainId)) return;
    if (chainId === appChainIdRef.current) return;
    setAppChainId(chainId);
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [isConnected, chainId, setAppChainId, router]);

  return null;
}
