"use client";

import {
  useCashout,
  useChain,
  usePrecalculatedCashouts,
  type Bet,
} from "@azuro-org/sdk";
import { GraphBetStatus } from "@azuro-org/toolkit";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBalanceQueryKey } from "wagmi/query";
import { useConnection } from "wagmi";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { AzuroWrongChainCallout } from "@/components/AzuroWrongChainCallout";
import { useToast } from "@/components/Toast";
import { formatWalletTxError } from "@/lib/userFacingTxError";

export type CashoutButtonProps = {
  bet: Bet;
};

function isPendingBet(bet: Bet): boolean {
  return (
    !bet.isWin &&
    !bet.isLose &&
    !bet.isCanceled &&
    !bet.isCashedOut
  );
}

export function CashoutButton({ bet }: CashoutButtonProps) {
  const { betToken, appChain } = useChain();
  const { showToast } = useToast();
  const { address } = useConnection();
  const azuroChain = useAzuroActionChain();
  const queryClient = useQueryClient();
  const pendingCashoutAfterApprove = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only show the cashout section when the bet is eligible in the usual sense
  // AND Azuro has actually issued a cashout quote (precalc > 0 with available
  // flag, or a cached value from a prior refetch). Otherwise every pending
  // bet showed a disabled Cash out button even though Azuro has not offered
  // cashout on a single one of our markets for weeks — pure UI noise.
  const eligibleByStatus =
    isPendingBet(bet) &&
    bet.freebetId === null &&
    bet.status === GraphBetStatus.Accepted;

  const precalc = usePrecalculatedCashouts({
    bet: {
      tokenId: bet.tokenId,
      amount: bet.amount,
      outcomes: bet.outcomes,
      status: bet.status,
      totalOdds: bet.totalOdds,
      freebetId: bet.freebetId,
    },
    query: { enabled: eligibleByStatus },
  });

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId: appChain.id, address }),
      });
    }
  }, [address, appChain.id, queryClient]);

  const { submit, isCashoutAvailable, isApproveRequired, calculationQuery, cashoutTx, approveTx } =
    useCashout({
      bet: { tokenId: bet.tokenId, outcomes: bet.outcomes },
      onSuccess: () => {
        setDialogOpen(false);
        setActionError(null);
        invalidateBalances();
        showToast("Cash out successful.", "success");
      },
      onError: (err) => {
        pendingCashoutAfterApprove.current = false;
        setActionError(formatWalletTxError(err ?? new Error("Cashout failed")));
      },
    });

  useEffect(() => {
    if (!pendingCashoutAfterApprove.current) return;
    const receipt = approveTx.receipt;
    if (!receipt || receipt.status !== "success") return;
    pendingCashoutAfterApprove.current = false;
    void submit();
  }, [approveTx.receipt, submit]);

  const isBusy =
    cashoutTx.isPending ||
    cashoutTx.isProcessing ||
    approveTx.isPending ||
    approveTx.isProcessing;

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) {
        e.preventDefault();
        pendingCashoutAfterApprove.current = false;
        setDialogOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, isBusy]);

  const handleConfirm = async () => {
    setActionError(null);
    try {
      if (isApproveRequired) {
        pendingCashoutAfterApprove.current = true;
      }
      await submit();
    } catch (e) {
      pendingCashoutAfterApprove.current = false;
      setActionError((prev) => prev ?? formatWalletTxError(e));
    }
  };

  const { cashoutAmount, isAvailable: precalcAvailable } = precalc.data ?? {};

  // `usePrecalculatedCashouts` auto-refetches every ~60s, which flickers
  // `precalc.isFetching` → disables the button and "—"s the amount for the
  // duration. Hold the last-known-good values so the UI stays stable during
  // a background refetch. Same pattern as min/max bet in `Betslip.tsx`.
  const stableCashoutAmountRef = useRef(cashoutAmount);
  const stablePrecalcAvailableRef = useRef(precalcAvailable);
  const stableIsCashoutAvailableRef = useRef(isCashoutAvailable);
  if (cashoutAmount != null && Number.isFinite(cashoutAmount)) {
    stableCashoutAmountRef.current = cashoutAmount;
  }
  if (precalcAvailable !== undefined) {
    stablePrecalcAvailableRef.current = precalcAvailable;
  }
  if (isCashoutAvailable !== undefined) {
    stableIsCashoutAvailableRef.current = isCashoutAvailable;
  }
  const stableCashoutAmount = cashoutAmount ?? stableCashoutAmountRef.current;
  const stablePrecalcAvailable =
    precalcAvailable ?? stablePrecalcAvailableRef.current;
  const stableIsCashoutAvailable =
    isCashoutAvailable ?? stableIsCashoutAvailableRef.current;

  const cashoutDisplay =
    stableCashoutAmount != null && Number.isFinite(stableCashoutAmount)
      ? stableCashoutAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : precalc.isLoading
        ? "…"
        : "—";

  const canTryCashout =
    azuroChain.onBetChain &&
    Boolean(stablePrecalcAvailable) &&
    Boolean(stableIsCashoutAvailable) &&
    !calculationQuery.isError;

  /**
   * Explain to users why the button is disabled. Before this, the button just
   * greyed out with a not-allowed cursor — a cashoutable-looking amount next
   * to an un-clickable button with no reason. Precedence matters: a real
   * calculation error is more actionable than a generic "unavailable".
   */
  const disabledReasonCopy: string | null = (() => {
    if (!azuroChain.onBetChain) {
      return null; // AzuroWrongChainCallout already handles this.
    }
    if (calculationQuery.isError) {
      return "Azuro's cashout service rejected this bet (often the market just suspended or the calculation expired). Try again in a few seconds.";
    }
    if (calculationQuery.isLoading) {
      return "Fetching a fresh cashout quote from Azuro…";
    }
    if (!stableIsCashoutAvailable) {
      return "Azuro has no cashout quote for this bet right now. Quotes refresh every ~60s — give it a moment or try again.";
    }
    if (!stablePrecalcAvailable) {
      return "Cashout is currently suspended for this market (the line is moving or the market just paused). The quote above is the last Azuro sent us.";
    }
    return null;
  })();

  /**
   * Log the underlying error once per (tokenId, error) pair so the browser
   * console has diagnostic detail. Gated on a debug flag so normal runs don't
   * spam users; set `NEXT_PUBLIC_CASHOUT_DEBUG=1` on the deploy to turn on.
   */
  const lastLoggedErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CASHOUT_DEBUG !== "1") return;
    const err = calculationQuery.error;
    if (err && err !== lastLoggedErrorRef.current) {
      lastLoggedErrorRef.current = err;
      console.warn("[cashout-debug] calculationQuery error", {
        tokenId: bet.tokenId,
        error: err,
      });
    }
  }, [calculationQuery.error, bet.tokenId]);

  const handleRetryCalculation = useCallback(() => {
    void calculationQuery.refetch();
  }, [calculationQuery]);

  if (!eligibleByStatus) {
    return null;
  }

  // Azuro globally had 0/6465 conditions cashout-enabled when we last measured,
  // so a permanently-disabled button + "—" value on every pending bet was pure
  // noise. Hide the section unless we have (or had) a real quote.
  const haveEverHadQuote =
    stableCashoutAmount != null && Number.isFinite(stableCashoutAmount);
  if (!precalc.isLoading && !haveEverHadQuote) {
    return null;
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-zinc-800/80 pt-3">
        {!azuroChain.onBetChain ? (
          <div className="w-full">
            <AzuroWrongChainCallout
              appChainName={azuroChain.appChainName}
              walletChainName={azuroChain.walletChainName}
              switchPending={azuroChain.switchPending}
              onSwitch={async () => {
                try {
                  await azuroChain.switchToAppChain();
                } catch (e) {
                  showToast(formatWalletTxError(e), "error");
                }
              }}
            />
          </div>
        ) : null}
        <div>
          <p className="text-xs text-zinc-500">Cash out value ({betToken.symbol})</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-zinc-100">
            {cashoutDisplay}
          </p>
        </div>
        <button
          type="button"
          disabled={!canTryCashout || isBusy}
          onClick={() => {
            setActionError(null);
            setDialogOpen(true);
          }}
          title={!canTryCashout && disabledReasonCopy ? disabledReasonCopy : undefined}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cash out
        </button>
      </div>
      {!canTryCashout && disabledReasonCopy ? (
        <div
          className="flex flex-wrap items-start gap-2 text-[11px] leading-snug text-zinc-500"
          role="status"
          aria-live="polite"
        >
          <span className="flex-1 min-w-0">{disabledReasonCopy}</span>
          {calculationQuery.isError || !stableIsCashoutAvailable ? (
            <button
              type="button"
              onClick={handleRetryCalculation}
              disabled={calculationQuery.isFetching}
              className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-60"
            >
              {calculationQuery.isFetching ? "Refetching…" : "Retry quote"}
            </button>
          ) : null}
        </div>
      ) : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (isBusy) return;
            pendingCashoutAfterApprove.current = false;
            setDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashout-dialog-title"
            className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="cashout-dialog-title"
              className="text-lg font-semibold text-zinc-50"
            >
              Confirm cashout
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              You will receive approximately{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-100">
                {cashoutDisplay} {betToken.symbol}
              </span>{" "}
              for this bet (before network fees). This action cannot be undone.
            </p>
            {actionError ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  pendingCashoutAfterApprove.current = false;
                  setDialogOpen(false);
                }}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canTryCashout || isBusy}
                onClick={() => void handleConfirm()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy
                  ? approveTx.isPending || approveTx.isProcessing
                    ? "Approving…"
                    : "Confirming…"
                  : isApproveRequired
                    ? "Approve & cash out"
                    : "Confirm cashout"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
