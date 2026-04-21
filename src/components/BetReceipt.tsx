"use client";

import { useChain } from "@azuro-org/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BetslipSelection } from "@/components/Betslip";
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { useToast } from "@/components/Toast";
import {
  formatBetReceiptShareText,
  shareOrCopyBetText,
  txExplorerUrlFromAppChain,
} from "@/lib/betShare";
import { formatOddsValue, formatStoredOddsString } from "@/lib/oddsFormat";

export type BetReceiptProps = {
  open: boolean;
  onClose: () => void;
  selections: BetslipSelection[];
  stakeLabel: string;
  tokenSymbol: string;
  totalOdds: number;
  potentialWin: number | null;
  transactionHash: `0x${string}` | undefined;
};

export function BetReceipt({
  open,
  onClose,
  selections,
  stakeLabel,
  tokenSymbol,
  totalOdds,
  potentialWin,
  transactionHash,
}: BetReceiptProps) {
  const { format: oddsFormat } = useOddsFormat();
  const { appChain } = useChain();
  const { showToast } = useToast();
  const [shareBusy, setShareBusy] = useState(false);
  const shareInFlightRef = useRef(false);
  const explorer = transactionHash
    ? txExplorerUrlFromAppChain(
        appChain.id,
        appChain.blockExplorers?.default?.url,
        transactionHash,
      )
    : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const main = document.querySelector("main");
    const prevMainOverflow = main?.style.overflow ?? "";
    if (main) {
      main.style.overflow = "hidden";
    }
    return () => {
      if (main) {
        main.style.overflow = prevMainOverflow;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleShare = useCallback(async () => {
    if (shareInFlightRef.current) {
      return;
    }
    shareInFlightRef.current = true;
    setShareBusy(true);
    try {
      const text = formatBetReceiptShareText(
        selections,
        stakeLabel,
        tokenSymbol,
        totalOdds,
        potentialWin,
        oddsFormat,
        transactionHash,
        explorer,
      );
      const result = await shareOrCopyBetText(text);
      if (result === "shared") {
        showToast("Shared.", "success");
      } else if (result === "copied") {
        showToast("Bet receipt copied to clipboard.", "success");
      } else if (result === "aborted") {
        showToast("Share cancelled.", "info");
      } else if (result === "failed") {
        showToast("Could not share or copy.", "error");
      }
    } finally {
      shareInFlightRef.current = false;
      setShareBusy(false);
    }
  }, [
    explorer,
    oddsFormat,
    potentialWin,
    selections,
    stakeLabel,
    showToast,
    tokenSymbol,
    totalOdds,
    transactionHash,
  ]);

  if (!open) {
    return null;
  }

  const isCombo = selections.length > 1;
  const oddsDisplay =
    totalOdds > 0 ? formatOddsValue(totalOdds, oddsFormat) : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bet-receipt-title"
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="bet-receipt-title"
          className="text-lg font-semibold text-zinc-50"
        >
          Bet placed
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {isCombo
            ? `Combo · ${selections.length} selections`
            : "Single"}
        </p>

        <ul className="mt-4 flex max-h-60 flex-col gap-2 overflow-y-auto border-t border-zinc-800 pt-3">
          {selections.map((s) => (
            <li key={s.id} className="text-sm">
              <p className="font-medium text-zinc-100">{s.gameTitle}</p>
              <p className="mt-1 text-zinc-200">{s.outcomeName}</p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-zinc-400">
                @{formatStoredOddsString(s.odds, oddsFormat)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800 pt-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Odds</dt>
            <dd className="type-odds text-zinc-100">
              {oddsDisplay}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Stake ({tokenSymbol})</dt>
            <dd className="font-mono font-semibold tabular-nums text-zinc-100">
              {stakeLabel}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-zinc-500">Potential win</dt>
            <dd className="font-mono font-semibold tabular-nums text-zinc-100">
              {potentialWin != null
                ? `${potentialWin.toFixed(2)} ${tokenSymbol}`
                : "—"}
            </dd>
          </div>
          {transactionHash ? (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-500">Transaction</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-300">
                {explorer ? (
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    {transactionHash}
                  </a>
                ) : (
                  transactionHash
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={shareBusy}
            onClick={() => void handleShare()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shareBusy ? "Sharing…" : "Share"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
