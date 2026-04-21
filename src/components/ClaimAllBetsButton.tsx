"use client";

import { useBetsSummary, useRedeemBet, type Bet } from "@azuro-org/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { getBalanceQueryKey } from "wagmi/query";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { AzuroWrongChainCallout } from "@/components/AzuroWrongChainCallout";
import { useToast } from "@/components/Toast";
import { betIsClaimable } from "@/lib/azuroClaimEligibility";
import { logClaimFailure } from "@/lib/claimDebugLog";
import { formatUserFacingTxError } from "@/lib/userFacingTxError";

/** Smaller first batches reduce block-gas / complex-leg blowups; wallet fee-cap bisect still narrows further. */
const CLAIM_BATCH_SIZE = 6;

function redeemBatchKey(bet: Bet): string {
  const pm = (bet.paymaster ?? zeroAddress).toLowerCase();
  const fb = bet.freebetId ?? "";
  return `${bet.lpAddress.toLowerCase()}_${bet.coreAddress.toLowerCase()}_${fb}_${pm}`;
}

function shouldRetryBatchWithSmallerSplit(error: unknown): boolean {
  const parts: string[] = [];
  let e: unknown = error;
  for (let d = 0; d < 8 && e != null && typeof e === "object"; d++) {
    const o = e as { message?: string; shortMessage?: string; details?: string; cause?: unknown };
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.shortMessage === "string") parts.push(o.shortMessage);
    if (typeof o.details === "string") parts.push(o.details);
    e = o.cause;
  }
  const t = parts.join(" ").toLowerCase();
  if (
    t.includes("user rejected") ||
    t.includes("user denied") ||
    t.includes("action_rejected") ||
    /\b4001\b/.test(t)
  ) {
    return false;
  }
  return (
    t.includes("exceeds the configured cap") ||
    (t.includes("tx fee") && t.includes("configured cap")) ||
    t.includes("gas required exceeds") ||
    t.includes("intrinsic gas too low") ||
    t.includes("exceeds block gas limit") ||
    t.includes("max fee per gas less than block base fee")
  );
}

/**
 * Tries `submit({ bets })` for the whole slice; on recoverable gas/fee-cap errors, bisects until singles.
 */
async function redeemSliceWithSplitFallback(
  submit: (props: { bets: Bet[] }) => Promise<unknown>,
  bets: Bet[],
): Promise<void> {
  if (bets.length === 0) return;
  try {
    await submit({ bets });
    return;
  } catch (e) {
    if (bets.length === 1 || !shouldRetryBatchWithSmallerSplit(e)) {
      throw e;
    }
    const mid = Math.ceil(bets.length / 2);
    await redeemSliceWithSplitFallback(submit, bets.slice(0, mid));
    await redeemSliceWithSplitFallback(submit, bets.slice(mid));
  }
}

async function redeemAllClaimableBatched(
  submit: (props: { bets: Bet[] }) => Promise<unknown>,
  claimable: Bet[],
): Promise<void> {
  const byKey = new Map<string, Bet[]>();
  for (const bet of claimable) {
    const k = redeemBatchKey(bet);
    const list = byKey.get(k);
    if (list) list.push(bet);
    else byKey.set(k, [bet]);
  }
  const keys = [...byKey.keys()].sort();
  for (const k of keys) {
    const group = byKey.get(k)!;
    for (let i = 0; i < group.length; i += CLAIM_BATCH_SIZE) {
      const chunk = group.slice(i, i + CLAIM_BATCH_SIZE);
      await redeemSliceWithSplitFallback(submit, chunk);
    }
  }
}

type BetsInfinitePage = { bets: Bet[] };

/** Merge every infinite page (Azuro `useBets`) using TanStack’s `hasNextPage` on each result — avoids stale React closures. */
async function loadAllBetsPages(
  bets: Bet[],
  fetchNextPage: () => Promise<{
    hasNextPage: boolean;
    data?: { pages: BetsInfinitePage[] };
  }>,
): Promise<Bet[]> {
  let res = await fetchNextPage();
  let merged = (res.data?.pages ?? []).flatMap((p) => p.bets);
  while (res.hasNextPage) {
    res = await fetchNextPage();
    merged = (res.data?.pages ?? []).flatMap((p) => p.bets);
  }
  return merged.length > 0 ? merged : bets;
}

export type ClaimAllBetsButtonProps = {
  bets: Bet[];
  /**
   * When set, every remaining `useBets` page is fetched before claiming.
   * Without this, only bets already in memory are claimed while `useBetsSummary`
   * “To claim” can reflect the full wallet — causing a large mismatch.
   */
  fetchNextPage?: () => Promise<{
    hasNextPage: boolean;
    data?: { pages: BetsInfinitePage[] };
  }>;
  /** When true with `fetchNextPage`, the button stays visible even if no claimable rows are on loaded pages yet. */
  hasNextPage?: boolean;
  /** Called after a successful run (refetch bet list, etc.). */
  onDone?: () => void;
};

export function ClaimAllBetsButton({
  bets,
  fetchNextPage,
  hasNextPage,
  onDone,
}: ClaimAllBetsButtonProps) {
  const { submit, isPending, isProcessing } = useRedeemBet();
  const { showToast } = useToast();
  const { address } = useConnection();
  const { data: summary } = useBetsSummary({
    account: address ?? "",
    query: { enabled: Boolean(address) },
  });
  const azuroChain = useAzuroActionChain();
  const queryClient = useQueryClient();
  const [sequentialBusy, setSequentialBusy] = useState(false);
  const [busyPhase, setBusyPhase] = useState<"idle" | "pages" | "claim">("idle");

  const claimableLoaded = useMemo(() => bets.filter(betIsClaimable), [bets]);

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId: azuroChain.appChainId, address }),
      });
    }
  }, [address, azuroChain.appChainId, queryClient]);

  const handleClaimAll = useCallback(async () => {
    const summaryPending = Number.parseFloat(summary?.toPayout ?? "0");
    const hasSummaryClaim =
      Number.isFinite(summaryPending) && summaryPending > 1e-6;
    if (
      claimableLoaded.length === 0 &&
      !fetchNextPage &&
      !hasSummaryClaim
    ) {
      return;
    }
    setSequentialBusy(true);
    let mergedBets = bets;
    try {
      if (fetchNextPage) {
        setBusyPhase("pages");
        mergedBets = await loadAllBetsPages(bets, fetchNextPage);
      }
      const claimable = mergedBets.filter(betIsClaimable);
      if (claimable.length === 0) {
        const pending = Number.parseFloat(summary?.toPayout ?? "0");
        if (Number.isFinite(pending) && pending > 1e-6) {
          showToast(
            "Your summary still shows unclaimed funds, but no redeemable wins were found in settled bets. Refresh the page or wait a minute for data to sync.",
            "info",
          );
        } else {
          showToast("No claimable bets found.", "info");
        }
        return;
      }
      setBusyPhase("claim");
      await redeemAllClaimableBatched(submit, claimable);

      invalidateBalances();
      showToast(
        `Claimed ${claimable.length} bet${claimable.length === 1 ? "" : "s"}.`,
        "success",
      );
      onDone?.();
    } catch (e) {
      const pendingClaim = mergedBets.filter(betIsClaimable);
      logClaimFailure(
        "claim_all",
        e,
        pendingClaim.length > 0 ? pendingClaim : mergedBets,
      );
      showToast(formatUserFacingTxError(e), "error");
    } finally {
      setBusyPhase("idle");
      setSequentialBusy(false);
    }
  }, [
    bets,
    claimableLoaded.length,
    fetchNextPage,
    submit,
    invalidateBalances,
    onDone,
    showToast,
    summary?.toPayout,
  ]);

  const loading = isPending || isProcessing || sequentialBusy;
  const loadingLabel =
    busyPhase === "pages"
      ? "Loading bets…"
      : loading
        ? "Claiming…"
        : null;

  const summaryToPayout = Number.parseFloat(summary?.toPayout ?? "0");
  const summaryShowsClaim =
    Number.isFinite(summaryToPayout) && summaryToPayout > 1e-6;

  if (
    claimableLoaded.length === 0 &&
    !(fetchNextPage && hasNextPage) &&
    !summaryShowsClaim
  ) {
    return null;
  }

  /*
   * While `hasNextPage` is true, `claimableLoaded` only reflects loaded slices; the number
   * jumps (39 → 59 → …) as TanStack merges pages or refetches. Show a count only once the
   * settled infinite query has finished loading every page (`!hasNextPage`).
   */
  const countIsComplete = !fetchNextPage || !hasNextPage;
  const claimCountLabel = !countIsComplete
    ? "Claim all"
    : claimableLoaded.length === 0 && summaryShowsClaim
      ? "Claim all"
      : `Claim all (${claimableLoaded.length})`;

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
        title={
          fetchNextPage
            ? "Until every settled page is loaded, the button does not show a bet count (only loaded pages are counted and the number can jump). Click to load all, then claim in batches (up to 6 per tx). If your wallet caps fees, batches split automatically."
            : "Claims redeemable wins in on-chain batches (up to 6 per tx). If your wallet caps fees, batches split automatically."
        }
        onClick={() => void handleClaimAll()}
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
      >
        {loadingLabel ?? claimCountLabel}
      </button>
    </div>
  );
}
