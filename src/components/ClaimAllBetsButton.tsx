"use client";

import { useBetsSummary, useRedeemBet, type Bet } from "@azuro-org/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBalanceQueryKey } from "wagmi/query";
import { useConnection } from "wagmi";
import { zeroAddress } from "viem";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { AzuroWrongChainCallout } from "@/components/AzuroWrongChainCallout";
import { useSettledBetsPrefetch } from "@/components/SettledBetsPrefetchProvider";
import { useToast } from "@/components/Toast";
import { betIsClaimable } from "@/lib/azuroClaimEligibility";
import { claimBetDebugSlice, logClaimFailure } from "@/lib/claimDebugLog";
import { formatWalletTxError } from "@/lib/userFacingTxError";

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

/** Ordered redeem chunks (same batching as the previous nested loops). */
function buildRedeemChunks(claimable: Bet[]): Bet[][] {
  const byKey = new Map<string, Bet[]>();
  for (const bet of claimable) {
    const k = redeemBatchKey(bet);
    const list = byKey.get(k);
    if (list) list.push(bet);
    else byKey.set(k, [bet]);
  }
  const keys = [...byKey.keys()].sort();
  const chunks: Bet[][] = [];
  for (const k of keys) {
    const group = byKey.get(k)!;
    for (let i = 0; i < group.length; i += CLAIM_BATCH_SIZE) {
      chunks.push(group.slice(i, i + CLAIM_BATCH_SIZE));
    }
  }
  return chunks;
}

type BetsInfinitePage = { bets: Bet[] };

/** Drain every infinite page (Azuro `useBets`) and read TanStack's accumulated `data.pages` once at the end. */
async function loadAllBetsPages(
  bets: Bet[],
  fetchNextPage: () => Promise<{
    hasNextPage: boolean;
    data?: { pages: BetsInfinitePage[] };
  }>,
): Promise<Bet[]> {
  let res = await fetchNextPage();
  while (res.hasNextPage) {
    res = await fetchNextPage();
  }
  const merged = (res.data?.pages ?? []).flatMap((p) => p.bets);
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
  const { data: summary, refetch: refetchBetsSummary } = useBetsSummary({
    account: address ?? "",
    query: { enabled: Boolean(address) },
  });
  const { refetch: refetchSettled } = useSettledBetsPrefetch();
  const azuroChain = useAzuroActionChain();
  const queryClient = useQueryClient();
  const [sequentialBusy, setSequentialBusy] = useState(false);
  const [busyPhase, setBusyPhase] = useState<"idle" | "pages" | "claim">("idle");
  const [claimBatch, setClaimBatch] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const lastMergedBetsRef = useRef<Bet[]>(bets);
  useEffect(() => {
    lastMergedBetsRef.current = bets;
  }, [bets]);

  const claimableLoaded = useMemo(() => bets.filter(betIsClaimable), [bets]);

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId: azuroChain.appChainId, address }),
      });
    }
  }, [address, azuroChain.appChainId, queryClient]);

  const handleRetryRefetch = useCallback(() => {
    setMismatchOpen(false);
    void refetchSettled();
    void refetchBetsSummary();
  }, [refetchSettled, refetchBetsSummary]);

  const handleReportMismatch = useCallback(
    async (mergedBets: Bet[]) => {
      const slice = mergedBets.slice(0, 60).map(claimBetDebugSlice);
      const text = JSON.stringify(
        {
          summaryToPayout: summary?.toPayout,
          betCount: mergedBets.length,
          slice,
        },
        null,
        2,
      );
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied debug report to clipboard.", "success");
      } catch {
        showToast("Could not copy to clipboard.", "error");
      }
    },
    [showToast, summary?.toPayout],
  );

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
    setMismatchOpen(false);
    setClaimBatch(null);
    let mergedBets = bets;
    let succeededBets = 0;
    try {
      if (fetchNextPage) {
        setBusyPhase("pages");
        mergedBets = await loadAllBetsPages(bets, fetchNextPage);
      }
      lastMergedBetsRef.current = mergedBets;
      const claimable = mergedBets.filter(betIsClaimable);
      if (claimable.length === 0) {
        const pending = Number.parseFloat(summary?.toPayout ?? "0");
        if (Number.isFinite(pending) && pending > 1e-6) {
          setMismatchOpen(true);
          showToast(
            "Summary still shows funds to claim, but no redeemable rows were found in loaded slips. Use Retry or copy a report below.",
            "info",
          );
        } else {
          showToast("No claimable bets found.", "info");
        }
        return;
      }
      setBusyPhase("claim");
      const chunks = buildRedeemChunks(claimable);
      const totalBatches = chunks.length;
      setClaimBatch({ done: 0, total: totalBatches });
      let claimAborted = false;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        try {
          await redeemSliceWithSplitFallback(submit, chunk);
          succeededBets += chunk.length;
          setClaimBatch({ done: i + 1, total: totalBatches });
        } catch (e) {
          const remaining = claimable.length - succeededBets;
          logClaimFailure(
            "claim_all_batch",
            e,
            chunk.length > 0 ? chunk : mergedBets,
          );
          showToast(
            `${formatWalletTxError(e)} — succeeded ${succeededBets} bet${succeededBets === 1 ? "" : "s"}; about ${remaining} not submitted yet. Retry or claim smaller sets from My bets.`,
            "error",
          );
          claimAborted = true;
          break;
        }
      }
      if (claimAborted) {
        return;
      }

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
      showToast(formatWalletTxError(e), "error");
    } finally {
      setBusyPhase("idle");
      setSequentialBusy(false);
      setClaimBatch(null);
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
      : busyPhase === "claim" && claimBatch && claimBatch.total > 0
        ? `Claiming ${claimBatch.done}/${claimBatch.total}…`
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

  const countIsComplete = !fetchNextPage || !hasNextPage;
  const claimCountLabel = !countIsComplete
    ? "Claim all"
    : claimableLoaded.length === 0 && summaryShowsClaim
      ? "Claim all"
      : `Claim all (${claimableLoaded.length})`;

  const helpText =
    fetchNextPage != null
      ? "Until every settled page is loaded, the button does not show a bet count (only loaded pages are counted and the number can jump). Click to load all, then claim in batches (up to 6 per tx). If your wallet caps fees, batches split automatically."
      : "Claims redeemable wins in on-chain batches (up to 6 per tx). If your wallet caps fees, batches split automatically.";

  return (
    <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
      {!azuroChain.onBetChain ? (
        <div className="w-full">
          <AzuroWrongChainCallout
            appChainName={azuroChain.appChainName}
            walletChainName={azuroChain.walletChainName}
            switchPending={azuroChain.switchPending}
            onSwitch={() => void azuroChain.switchToAppChain().catch(() => {})}
          />
        </div>
      ) : null}
      <button
        type="button"
        disabled={loading || !azuroChain.onBetChain}
        title={helpText}
        onClick={() => void handleClaimAll()}
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
      >
        {loadingLabel ?? claimCountLabel}
      </button>
      <p className="hidden max-w-md text-left text-[11px] leading-snug text-zinc-500 md:block">
        {helpText}
      </p>
      {mismatchOpen && summaryShowsClaim ? (
        <div
          className="flex max-w-md flex-col gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-100"
          role="region"
          aria-label="Claim data mismatch actions"
        >
          <p className="text-amber-50/95">
            Azuro summary and loaded slips disagree. Try refetching both feeds, or copy a
            debug slice for support.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-500"
              onClick={() => void handleRetryRefetch()}
            >
              Retry / refetch
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-700/80 px-3 py-1.5 font-medium text-amber-100 hover:bg-amber-950/50"
              onClick={() => void handleReportMismatch(lastMergedBetsRef.current)}
            >
              Report (copy)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
