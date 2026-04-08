"use client";

import { useBet, useChain } from "@azuro-org/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { zeroAddress } from "viem";

export type BetslipSelection = {
  id: string;
  gameId: string;
  outcomeName: string;
  odds: string;
  conditionId: string;
  outcomeId: string;
};

type BetslipContextValue = {
  selections: BetslipSelection[];
  addSelection: (item: {
    gameId: string;
    outcomeName: string;
    odds: string;
    conditionId: string;
    outcomeId: string;
  }) => void;
  removeSelection: (id: string) => void;
};

const BetslipContext = createContext<BetslipContextValue | null>(null);

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) {
    throw new Error("useBetslip must be used within BetslipProvider");
  }
  return ctx;
}

export function selectionId(
  gameId: string,
  outcomeName: string,
  outcomeId?: string,
): string {
  if (outcomeId) {
    return `${gameId}::${outcomeId}`;
  }
  return `${gameId}::${outcomeName}`;
}

export function BetslipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetslipSelection[]>([]);

  const addSelection = useCallback(
    (item: {
      gameId: string;
      outcomeName: string;
      odds: string;
      conditionId: string;
      outcomeId: string;
    }) => {
      const id = selectionId(item.gameId, item.outcomeName, item.outcomeId);
      setSelections((prev) => {
        const next = prev.filter((s) => s.id !== id);
        next.push({
          id,
          gameId: item.gameId,
          outcomeName: item.outcomeName,
          odds: item.odds,
          conditionId: item.conditionId,
          outcomeId: item.outcomeId,
        });
        return next;
      });
    },
    [],
  );

  const removeSelection = useCallback((id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({ selections, addSelection, removeSelection }),
    [selections, addSelection, removeSelection],
  );

  return (
    <BetslipContext.Provider value={value}>{children}</BetslipContext.Provider>
  );
}

const SLIPPAGE_PERCENT = 5;

function parseDecimalOdds(oddsStr: string): number {
  const n = Number.parseFloat(oddsStr);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function BetslipStakeAndPlace({ selections }: { selections: BetslipSelection[] }) {
  const { betToken } = useChain();
  const { address, isConnected } = useAccount();
  const [stake, setStake] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sdkSelections = useMemo(
    () =>
      selections.map((s) => ({
        conditionId: s.conditionId,
        outcomeId: s.outcomeId,
      })),
    [selections],
  );

  const oddsRecord = useMemo(() => {
    const o: Record<string, number> = {};
    for (const s of selections) {
      const v = parseDecimalOdds(s.odds);
      if (!Number.isFinite(v)) {
        return null;
      }
      o[`${s.conditionId}-${s.outcomeId}`] = v;
    }
    return o;
  }, [selections]);

  const totalOdds = useMemo(() => {
    if (!oddsRecord) {
      return 0;
    }
    let product = 1;
    for (const s of selections) {
      const v = parseDecimalOdds(s.odds);
      if (!Number.isFinite(v)) {
        return 0;
      }
      product *= v;
    }
    return product;
  }, [selections, oddsRecord]);

  const stakeAmount = stake.trim();
  const stakeNum = Number.parseFloat(stakeAmount);
  const stakeValid = Number.isFinite(stakeNum) && stakeNum > 0;

  const potentialWin =
    stakeValid && totalOdds > 0 ? stakeNum * totalOdds : null;

  const { submit, approveTx, betTx, isApproveRequired, isWalletReadyToSubmit } =
    useBet({
      betAmount: stakeValid ? stakeAmount : "0",
      slippage: SLIPPAGE_PERCENT,
      affiliate: zeroAddress,
      selections: sdkSelections,
      odds: oddsRecord ?? {},
      totalOdds,
      onSuccess: () => {
        setSuccess(true);
        setErrorMessage(null);
      },
      onError: (err) => {
        setSuccess(false);
        setErrorMessage(err?.message ?? "Could not place bet.");
      },
    });

  const isBusy =
    approveTx.isPending ||
    approveTx.isProcessing ||
    betTx.isPending ||
    betTx.isProcessing;

  const canSubmit =
    stakeValid &&
    oddsRecord !== null &&
    totalOdds > 0 &&
    isConnected &&
    Boolean(address) &&
    isWalletReadyToSubmit &&
    !isBusy;

  const placeBetLabel = isApproveRequired ? "Approve token" : "Place Bet";

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-zinc-800 pt-4">
      <label className="text-xs font-medium text-zinc-400" htmlFor="betslip-stake">
        Stake ({betToken.symbol})
      </label>
      <div className="flex items-center gap-2">
        <input
          id="betslip-stake"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0"
          value={stake}
          onChange={(e) => {
            setStake(e.target.value);
            setSuccess(false);
            setErrorMessage(null);
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <p className="text-xs text-zinc-500">
        Potential win:{" "}
        <span className="font-semibold tabular-nums text-zinc-300">
          {potentialWin != null
            ? `${potentialWin.toFixed(2)} ${betToken.symbol}`
            : "—"}
        </span>
        {selections.length > 1 ? (
          <span className="text-zinc-600"> (combined odds)</span>
        ) : null}
      </p>
      {isApproveRequired ? (
        <p className="text-xs text-amber-500/90">
          Approve {betToken.symbol} for the relayer, then tap Place Bet again to
          confirm.
        </p>
      ) : null}
      {!isConnected ? (
        <p className="text-xs text-zinc-500">Connect a wallet to place a bet.</p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-800/80 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Bet placed successfully.
          {betTx.receipt?.transactionHash ? (
            <>
              {" "}
              Transaction{" "}
              <span className="font-mono text-xs">
                {betTx.receipt.transactionHash.slice(0, 10)}…
              </span>
            </>
          ) : null}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="rounded-md border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isBusy ? "Working…" : placeBetLabel}
      </button>
    </div>
  );
}

export function BetslipPanel() {
  const { selections, removeSelection } = useBetslip();

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Betslip
      </p>
      {selections.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No selections yet.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {selections.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100">{s.outcomeName}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-300">
                    {s.odds}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelection(s.id)}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label={`Remove ${s.outcomeName}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <BetslipStakeAndPlace
            key={selections.map((s) => s.id).join("|")}
            selections={selections}
          />
        </>
      )}
    </>
  );
}
