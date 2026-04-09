"use client";

import {
  BetslipDisableReason,
  useBaseBetslip,
  useBet,
  useChain,
  useDetailedBetslip,
} from "@azuro-org/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import { BetReceipt } from "@/components/BetReceipt";
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { useToast } from "@/components/Toast";
import { formatOddsValue, formatStoredOddsString } from "@/lib/oddsFormat";

export type BetslipSelection = {
  id: string;
  gameId: string;
  /** Match / event title shown on the receipt (e.g. Team A vs Team B). */
  gameTitle: string;
  outcomeName: string;
  odds: string;
  conditionId: string;
  outcomeId: string;
};

type BetslipContextValue = {
  selections: BetslipSelection[];
  addSelection: (item: {
    gameId: string;
    gameTitle: string;
    outcomeName: string;
    odds: string;
    conditionId: string;
    outcomeId: string;
    isExpressForbidden?: boolean;
  }) => void;
  clearSelections: () => void;
  removeSelection: (id: string) => void;
};

const BetslipContext = createContext<BetslipContextValue | null>(null);

type BetslipMobileDrawerContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const BetslipMobileDrawerContext =
  createContext<BetslipMobileDrawerContextValue | null>(null);

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) {
    throw new Error("useBetslip must be used within BetslipProvider");
  }
  return ctx;
}

export function useBetslipMobileDrawer() {
  const ctx = useContext(BetslipMobileDrawerContext);
  if (!ctx) {
    throw new Error("useBetslipMobileDrawer must be used within BetslipProvider");
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
  const { items, addItem, removeItem, clear } = useBaseBetslip();
  const [metaById, setMetaById] = useState<Record<string, BetslipSelection>>({});
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  const validSelectionIds = useMemo(
    () =>
      new Set(
        items.map((item) => selectionId(item.gameId, "", item.outcomeId)),
      ),
    [items],
  );

  const metaByIdSynced = useMemo(() => {
    const next: Record<string, BetslipSelection> = {};
    for (const key of Object.keys(metaById)) {
      if (validSelectionIds.has(key)) {
        next[key] = metaById[key]!;
      }
    }
    return next;
  }, [metaById, validSelectionIds]);

  const selections = useMemo((): BetslipSelection[] => {
    return items.map((item) => {
      const id = selectionId(item.gameId, "", item.outcomeId);
      return (
        metaByIdSynced[id] ?? {
          id,
          gameId: item.gameId,
          gameTitle: "—",
          outcomeName: "—",
          odds: "—",
          conditionId: item.conditionId,
          outcomeId: item.outcomeId,
        }
      );
    });
  }, [items, metaByIdSynced]);

  const addSelection = useCallback(
    (item: {
      gameId: string;
      gameTitle: string;
      outcomeName: string;
      odds: string;
      conditionId: string;
      outcomeId: string;
      isExpressForbidden?: boolean;
    }) => {
      const id = selectionId(item.gameId, item.outcomeName, item.outcomeId);
      const row: BetslipSelection = {
        id,
        gameId: item.gameId,
        gameTitle: item.gameTitle,
        outcomeName: item.outcomeName,
        odds: item.odds,
        conditionId: item.conditionId,
        outcomeId: item.outcomeId,
      };
      setMetaById((prev) => ({ ...prev, [id]: row }));
      addItem({
        gameId: item.gameId,
        conditionId: item.conditionId,
        outcomeId: item.outcomeId,
        isExpressForbidden: item.isExpressForbidden ?? false,
      });
    },
    [addItem],
  );

  const removeSelection = useCallback(
    (id: string) => {
      const row =
        metaByIdSynced[id] ??
        items.find(
          (item) => selectionId(item.gameId, "", item.outcomeId) === id,
        );
      if (row) {
        removeItem({ conditionId: row.conditionId, outcomeId: row.outcomeId });
        setMetaById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [metaByIdSynced, items, removeItem],
  );

  const clearSelections = useCallback(() => {
    clear();
    setMetaById({});
  }, [clear]);

  const value = useMemo(
    () => ({ selections, addSelection, removeSelection, clearSelections }),
    [selections, addSelection, removeSelection, clearSelections],
  );

  const mobileDrawer = useMemo(
    () => ({
      open: mobileDrawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [mobileDrawerOpen, openDrawer, closeDrawer],
  );

  return (
    <BetslipContext.Provider value={value}>
      <BetslipMobileDrawerContext.Provider value={mobileDrawer}>
        {children}
        <MobileBetslipDrawer />
      </BetslipMobileDrawerContext.Provider>
    </BetslipContext.Provider>
  );
}

function MobileBetslipDrawer() {
  const { open, closeDrawer } = useBetslipMobileDrawer();

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDrawer]);

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close betslip"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={closeDrawer}
      />
      <div
        className={`betslip-slide-panel absolute bottom-0 right-0 top-[max(0.5rem,env(safe-area-inset-top))] flex w-full max-w-md flex-col border-l border-t border-zinc-700 bg-zinc-900 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Betslip"
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">Betslip</p>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-2">
          <BetslipPanel />
        </div>
      </div>
    </div>
  );
}

const SLIPPAGE_PERCENT = 5;

const QUICK_STAKE_PRESETS = ["5", "10", "25", "50"] as const;

type BetslipMode = "single" | "combo";

function messageForBetslipDisableReason(
  reason: BetslipDisableReason | undefined,
): string | null {
  if (reason == null) {
    return null;
  }
  switch (reason) {
    case BetslipDisableReason.ConditionState:
      return "One or more selections are no longer active. Remove or replace them.";
    case BetslipDisableReason.BetAmountGreaterThanMaxBet:
      return "Stake is above the maximum allowed for this bet.";
    case BetslipDisableReason.BetAmountLowerThanMinBet:
      return "Stake is below the minimum for this bet.";
    case BetslipDisableReason.ComboWithForbiddenItem:
      return "This combo includes a selection that cannot be combined. Remove a leg or bet singles.";
    case BetslipDisableReason.ComboWithSameGame:
      return "Combo cannot include more than one outcome from the same game.";
    case BetslipDisableReason.SelectedOutcomesTemporarySuspended:
      return "One or more selections are temporarily unavailable.";
    case BetslipDisableReason.TotalOddsTooLow:
      return "Total odds are too low for this bet.";
    case BetslipDisableReason.FreeBetExpired:
      return "The selected free bet has expired.";
    case BetslipDisableReason.PrematchConditionInStartedGame:
      return "A prematch selection is invalid for a game that has already started.";
    default:
      return "This bet cannot be placed right now.";
  }
}

function BetslipStakeAndPlace({ selections }: { selections: BetslipSelection[] }) {
  const { format: oddsFormat } = useOddsFormat();
  const { betToken } = useChain();
  const {
    betAmount,
    changeBetAmount,
    odds: sdkOdds,
    totalOdds: sdkTotalOdds,
    disableReason,
    isBetAllowed,
    isOddsFetching,
    isBetCalculationFetching,
  } = useDetailedBetslip();
  const { showToast } = useToast();
  const { clearSelections } = useBetslip();
  const { address, isConnected } = useAccount();
  const { data: tokenBalanceRaw } = useReadContract({
    address: betToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isConnected && betToken.address),
    },
  });

  const applyStake = useCallback(
    (value: string) => {
      changeBetAmount(value);
      setErrorMessage(null);
    },
    [changeBetAmount],
  );

  const fillMaxStake = useCallback(() => {
    if (tokenBalanceRaw == null || tokenBalanceRaw === BigInt(0)) {
      return;
    }
    applyStake(formatUnits(tokenBalanceRaw, betToken.decimals));
  }, [applyStake, betToken.decimals, tokenBalanceRaw]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    selections: BetslipSelection[];
    stakeLabel: string;
    totalOdds: number;
    potentialWin: number | null;
    txHash: `0x${string}` | undefined;
    /** Whether to empty the slip when the receipt closes (captures leg index at bet time). */
    clearSlipOnClose: boolean;
  } | null>(null);
  const [mode, setMode] = useState<BetslipMode>("combo");
  const [singleLegIndex, setSingleLegIndex] = useState(0);

  const multiPick = selections.length > 1;
  const maxLegIndex = Math.max(0, selections.length - 1);
  const effectiveLegIndex =
    multiPick && mode === "single"
      ? Math.min(singleLegIndex, maxLegIndex)
      : 0;

  const activeSelections = useMemo(() => {
    if (!multiPick || mode === "combo") {
      return selections;
    }
    const leg = selections[effectiveLegIndex];
    return leg ? [leg] : selections;
  }, [selections, multiPick, mode, effectiveLegIndex]);

  const sdkSelections = useMemo(
    () =>
      activeSelections.map((s) => ({
        conditionId: s.conditionId,
        outcomeId: s.outcomeId,
      })),
    [activeSelections],
  );

  const oddsRecord = useMemo(() => {
    const o: Record<string, number> = {};
    for (const s of activeSelections) {
      const key = `${s.conditionId}-${s.outcomeId}`;
      const v = sdkOdds[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return null;
      }
      o[key] = v;
    }
    return o;
  }, [activeSelections, sdkOdds]);

  const totalOddsForBet = useMemo(() => {
    if (!activeSelections.length) {
      return 0;
    }
    if (mode === "single" && multiPick) {
      const s = activeSelections[0]!;
      const v = sdkOdds[`${s.conditionId}-${s.outcomeId}`];
      return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
    }
    return typeof sdkTotalOdds === "number" &&
      Number.isFinite(sdkTotalOdds) &&
      sdkTotalOdds > 0
      ? sdkTotalOdds
      : 0;
  }, [activeSelections, mode, multiPick, sdkOdds, sdkTotalOdds]);

  /** Combined odds for display when in combo mode (matches SDK total). */
  const totalOddsDisplay =
    mode === "combo" && multiPick ? sdkTotalOdds : totalOddsForBet;

  const stakeAmount = betAmount.trim();
  const stakeNum = Number.parseFloat(stakeAmount);
  const stakeValid = Number.isFinite(stakeNum) && stakeNum > 0;

  const singleLegOdds =
    multiPick && mode === "single" && activeSelections[0]
      ? sdkOdds[
          `${activeSelections[0].conditionId}-${activeSelections[0].outcomeId}`
        ]
      : NaN;
  const potentialWinSingleLeg =
    stakeValid &&
    typeof singleLegOdds === "number" &&
    Number.isFinite(singleLegOdds) &&
    singleLegOdds > 0
      ? stakeNum * singleLegOdds
      : null;

  const potentialWinCombo =
    mode === "combo" && stakeValid && sdkTotalOdds > 0
      ? stakeNum * sdkTotalOdds
      : null;

  const potentialWinDisplay =
    mode === "combo" ? potentialWinCombo : potentialWinSingleLeg;

  const receiptTotalOdds = totalOddsForBet;

  const sdkDisableMessage = messageForBetslipDisableReason(disableReason);

  const { submit, approveTx, betTx, isApproveRequired, isWalletReadyToSubmit } =
    useBet({
      betAmount: stakeValid ? stakeAmount : "0",
      slippage: SLIPPAGE_PERCENT,
      affiliate: zeroAddress,
      selections: sdkSelections,
      odds: oddsRecord ?? {},
      totalOdds: totalOddsForBet,
      onSuccess: (receipt) => {
        setErrorMessage(null);
        const placedSelections = activeSelections.map((s) => ({ ...s }));
        const win =
          mode === "combo"
            ? potentialWinCombo
            : potentialWinSingleLeg;
        const legJustPlaced = effectiveLegIndex;
        const clearSlipOnClose =
          mode === "combo" ||
          !multiPick ||
          (mode === "single" &&
            multiPick &&
            legJustPlaced >= selections.length - 1);
        setReceiptSnapshot({
          selections: placedSelections,
          stakeLabel: stakeAmount,
          totalOdds: receiptTotalOdds,
          potentialWin: win,
          txHash: receipt?.transactionHash,
          clearSlipOnClose,
        });
        setReceiptOpen(true);
        showToast("Bet placed successfully.", "success");
        if (mode === "single" && multiPick) {
          setSingleLegIndex((i) =>
            i < selections.length - 1 ? i + 1 : i,
          );
        }
      },
      onError: (err) => {
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
    totalOddsForBet > 0 &&
    isConnected &&
    Boolean(address) &&
    isWalletReadyToSubmit &&
    !isBusy &&
    !isOddsFetching &&
    !isBetCalculationFetching &&
    isBetAllowed;

  const placeBetLabel = isApproveRequired
    ? "Approve token"
    : mode === "single" && multiPick
      ? `Place bet (leg ${effectiveLegIndex + 1}/${selections.length})`
      : "Place Bet";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4">
      {multiPick ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-zinc-400">Bet type</p>
          <div className="flex rounded-md border border-zinc-700 p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("single");
                setSingleLegIndex(0);
                setErrorMessage(null);
              }}
              className={`min-h-11 flex-1 rounded px-2 py-2 text-xs font-medium transition md:min-h-0 md:py-1.5 ${
                mode === "single"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("combo");
                setErrorMessage(null);
              }}
              className={`min-h-11 flex-1 rounded px-2 py-2 text-xs font-medium transition md:min-h-0 md:py-1.5 ${
                mode === "combo"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Combo
            </button>
          </div>
        </div>
      ) : null}
      <label className="text-xs font-medium text-zinc-400" htmlFor="betslip-stake">
        Stake ({betToken.symbol})
      </label>
      <div className="flex flex-wrap gap-2">
        {QUICK_STAKE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyStake(preset)}
            className="min-h-9 min-w-[2.75rem] touch-manipulation rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium tabular-nums text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 active:bg-zinc-800/90"
          >
            {preset}
          </button>
        ))}
        <button
          type="button"
          onClick={fillMaxStake}
          disabled={
            !isConnected ||
            tokenBalanceRaw == null ||
            tokenBalanceRaw === BigInt(0)
          }
          className="min-h-9 touch-manipulation rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          MAX
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="betslip-stake"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0"
          value={betAmount}
          onChange={(e) => applyStake(e.target.value)}
          className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 md:min-h-0 md:text-sm"
        />
      </div>
      {mode === "combo" && multiPick ? (
        <p className="text-xs text-zinc-500">
          Combined odds:{" "}
          <span className="font-mono font-semibold tabular-nums text-zinc-300">
            {isOddsFetching
              ? "…"
              : totalOddsDisplay > 0
                ? formatOddsValue(totalOddsDisplay, oddsFormat)
                : "—"}
          </span>
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Potential win:{" "}
        <span className="font-mono font-semibold tabular-nums text-zinc-300">
          {potentialWinDisplay != null
            ? `${potentialWinDisplay.toFixed(2)} ${betToken.symbol}`
            : "—"}
        </span>
        {mode === "combo" && multiPick ? (
          <span className="text-zinc-600"> (combo payout)</span>
        ) : null}
        {mode === "single" && multiPick ? (
          <span className="text-zinc-600">
            {" "}
            (this leg only; stake applies per bet)
          </span>
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
      {isConnected && sdkDisableMessage && !isBetAllowed ? (
        <p
          className="rounded-md border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
          role="status"
        >
          {sdkDisableMessage}
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
        className="min-h-11 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-[background-color,transform,opacity] duration-200 ease-out hover:scale-[1.02] hover:bg-amber-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 md:min-h-0 md:py-2"
      >
        {isBusy ? "Working…" : placeBetLabel}
      </button>
      {receiptSnapshot ? (
        <BetReceipt
          open={receiptOpen}
          onClose={() => {
            setReceiptOpen(false);
            if (receiptSnapshot.clearSlipOnClose) {
              clearSelections();
            }
            setReceiptSnapshot(null);
          }}
          selections={receiptSnapshot.selections}
          stakeLabel={receiptSnapshot.stakeLabel}
          tokenSymbol={betToken.symbol}
          totalOdds={receiptSnapshot.totalOdds}
          potentialWin={receiptSnapshot.potentialWin}
          transactionHash={receiptSnapshot.txHash}
        />
      ) : null}
    </div>
  );
}

export function BetslipPanel() {
  const { format: oddsFormat } = useOddsFormat();
  const { selections, removeSelection } = useBetslip();

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Betslip
      </p>
      {selections.length === 0 ? (
        <div
          className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-9 text-center"
          role="status"
        >
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 text-zinc-400"
            aria-hidden
          >
            {/* Betslip / ticket icon (aligned with mobile nav Slip glyph) */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H4V9Z" />
              <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M9 14h6" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-semibold text-zinc-200">
            Your betslip is empty
          </p>
          <p className="mt-1.5 max-w-[17rem] text-xs leading-relaxed text-zinc-500">
            Tap odds on any game to add picks. With more than one selection you
            can place singles or a combo.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {selections.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">{s.gameTitle}</p>
                  <p className="mt-0.5 text-sm text-zinc-100">{s.outcomeName}</p>
                  <p className="type-odds mt-0.5 text-zinc-300">
                    {formatStoredOddsString(s.odds, oddsFormat)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelection(s.id)}
                  className="min-h-11 shrink-0 rounded px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:min-h-0 md:px-2 md:py-1"
                  aria-label={`Remove ${s.outcomeName}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <BetslipStakeAndPlace selections={selections} />
        </>
      )}
    </>
  );
}
