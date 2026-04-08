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
import { useChainId, useConnection } from "wagmi";
import { useToast } from "@/components/Toast";

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
  const { betToken } = useChain();
  const { showToast } = useToast();
  const { address } = useConnection();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const pendingCashoutAfterApprove = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const showCashoutUi =
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
    query: { enabled: showCashoutUi },
  });

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId, address }),
      });
    }
  }, [address, chainId, queryClient]);

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
        setActionError(err?.message ?? "Cashout failed");
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

  const handleConfirm = async () => {
    setActionError(null);
    try {
      if (isApproveRequired) {
        pendingCashoutAfterApprove.current = true;
      }
      await submit();
    } catch {
      pendingCashoutAfterApprove.current = false;
      setActionError((prev) => prev ?? "Transaction failed");
    }
  };

  const { cashoutAmount, isAvailable: precalcAvailable } = precalc.data ?? {};
  const cashoutDisplay =
    precalc.isLoading && cashoutAmount === undefined
      ? "…"
      : cashoutAmount != null && Number.isFinite(cashoutAmount)
        ? cashoutAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "—";

  const canTryCashout =
    Boolean(precalcAvailable) &&
    !precalc.isLoading &&
    isCashoutAvailable &&
    !calculationQuery.isFetching &&
    !calculationQuery.isError;

  if (!showCashoutUi) {
    return null;
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-zinc-800/80 pt-3">
        <div>
          <p className="text-xs text-zinc-500">Cash out value ({betToken.symbol})</p>
          <p className="mt-0.5 font-semibold tabular-nums text-zinc-100">
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
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cash out
        </button>
      </div>

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
              <span className="font-semibold tabular-nums text-zinc-100">
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
