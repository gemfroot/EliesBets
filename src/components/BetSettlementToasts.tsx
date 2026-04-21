"use client";

import { useEffect, useRef } from "react";
import { useConnection } from "wagmi";
import { useToast } from "@/components/Toast";
import { useSettledBetsPrefetch } from "@/components/SettledBetsPrefetchProvider";

/**
 * Shows win/loss toasts when a bet settles (from cached graph data).
 * Settled pages are prefetched by `SettledBetsPrefetchProvider` (single `fetchNextPage` owner).
 */
export function BetSettlementToasts() {
  const { address } = useConnection();
  const { showToast } = useToast();
  const { settledBets } = useSettledBetsPrefetch();
  const seen = useRef<Map<string, { win: boolean; lose: boolean }>>(new Map());
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
    seen.current = new Map();
  }, [address]);

  useEffect(() => {
    if (!settledBets.length) {
      return;
    }

    if (!hydrated.current) {
      for (const bet of settledBets) {
        const id = bet.orderId;
        seen.current.set(id, {
          win: bet.isWin && !bet.isCanceled,
          lose: bet.isLose && !bet.isCanceled,
        });
      }
      hydrated.current = true;
      return;
    }

    for (const bet of settledBets) {
      const id = bet.orderId;
      const win = bet.isWin && !bet.isCanceled;
      const lose = bet.isLose && !bet.isCanceled;
      const prev = seen.current.get(id);
      if (prev === undefined) {
        if (win) {
          showToast("Bet won!", "success");
        }
        if (lose) {
          showToast("Bet lost.", "info");
        }
        seen.current.set(id, { win, lose });
        continue;
      }
      if (!prev.win && win) {
        showToast("Bet won!", "success");
      }
      if (!prev.lose && lose) {
        showToast("Bet lost.", "info");
      }
      seen.current.set(id, { win, lose });
    }
  }, [settledBets, showToast]);

  return null;
}
