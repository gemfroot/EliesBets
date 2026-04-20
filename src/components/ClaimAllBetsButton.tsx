"use client";

import { useRedeemBet, type Bet } from "@azuro-org/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { getBalanceQueryKey } from "wagmi/query";
import { useConnection } from "wagmi";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { AzuroWrongChainCallout } from "@/components/AzuroWrongChainCallout";
import { useToast } from "@/components/Toast";
import { formatUserFacingTxError } from "@/lib/userFacingTxError";

function isClaimable(bet: Bet): boolean {
  return (
    bet.isWin &&
    !bet.isCanceled &&
    bet.isRedeemable &&
    !bet.isRedeemed
  );
}

/** Same LP + core as required by Azuro batch `withdrawPayouts`. */
function batchKey(bet: Bet): string {
  return `${bet.lpAddress.toLowerCase()}\0${bet.coreAddress.toLowerCase()}`;
}

export type ClaimAllBetsButtonProps = {
  bets: Bet[];
  /** Called after a successful run (refetch bet list, etc.). */
  onDone?: () => void;
};

export function ClaimAllBetsButton({ bets, onDone }: ClaimAllBetsButtonProps) {
  const { submit, isPending, isProcessing } = useRedeemBet();
  const { showToast } = useToast();
  const { address } = useConnection();
  const azuroChain = useAzuroActionChain();
  const queryClient = useQueryClient();
  const [sequentialBusy, setSequentialBusy] = useState(false);

  const claimable = useMemo(() => bets.filter(isClaimable), [bets]);

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId: azuroChain.appChainId, address }),
      });
    }
  }, [address, azuroChain.appChainId, queryClient]);

  const handleClaimAll = useCallback(async () => {
    if (claimable.length === 0) return;
    setSequentialBusy(true);
    try {
      const withFreebet = claimable.filter((b) => b.freebetId != null);
      const paid = claimable.filter((b) => b.freebetId == null);

      const groups = new Map<string, Bet[]>();
      for (const b of paid) {
        const k = batchKey(b);
        const list = groups.get(k) ?? [];
        list.push(b);
        groups.set(k, list);
      }

      for (const [, group] of groups) {
        if (group.length === 0) continue;
        try {
          await submit({ bets: group });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (
            msg.includes("v2 redeem can't be executed for multiple bets")
          ) {
            for (const bet of group) {
              await submit({ bets: [bet] });
            }
          } else {
            throw e;
          }
        }
      }

      for (const bet of withFreebet) {
        await submit({ bets: [bet] });
      }

      invalidateBalances();
      showToast(
        `Claimed ${claimable.length} bet${claimable.length === 1 ? "" : "s"}.`,
        "success",
      );
      onDone?.();
    } catch (e) {
      showToast(formatUserFacingTxError(e), "error");
    } finally {
      setSequentialBusy(false);
    }
  }, [claimable, submit, invalidateBalances, onDone, showToast]);

  const loading = isPending || isProcessing || sequentialBusy;

  if (claimable.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
      {!azuroChain.onBetChain ? (
        <AzuroWrongChainCallout
          appChainName={azuroChain.appChainName}
          walletChainName={azuroChain.walletChainName}
          switchPending={azuroChain.switchPending}
          onSwitch={() => void azuroChain.switchToAppChain().catch(() => {})}
        />
      ) : null}
      <button
        type="button"
        disabled={loading || !azuroChain.onBetChain}
        onClick={() => void handleClaimAll()}
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
      >
        {loading ? "Claiming…" : `Claim all (${claimable.length})`}
      </button>
    </div>
  );
}
