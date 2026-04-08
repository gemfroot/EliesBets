"use client";

import { BetType, useBets } from "@azuro-org/sdk";
import { useEffect, useRef } from "react";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";
import { useToast } from "@/components/Toast";

/**
 * Shows win/loss toasts when a bet settles (from cached graph data).
 */
export function BetSettlementToasts() {
  const { address, isConnected } = useConnection();
  const { showToast } = useToast();
  const seen = useRef<Map<string, { win: boolean; lose: boolean }>>(new Map());
  const hydrated = useRef(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBets({
    filter: { bettor: address ?? zeroAddress, type: BetType.Settled },
    query: { enabled: Boolean(isConnected && address) },
  });

  useEffect(() => {
    hydrated.current = false;
    seen.current = new Map();
  }, [address]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!data?.pages?.length) {
      return;
    }
    if (hasNextPage || isFetchingNextPage) {
      return;
    }

    const bets = data.pages.flatMap((p) => p.bets);

    if (!hydrated.current) {
      for (const bet of bets) {
        const id = bet.orderId;
        seen.current.set(id, {
          win: bet.isWin && !bet.isCanceled,
          lose: bet.isLose && !bet.isCanceled,
        });
      }
      hydrated.current = true;
      return;
    }

    for (const bet of bets) {
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
  }, [data, hasNextPage, isFetchingNextPage, showToast]);

  return null;
}
