"use client";

import {
  BetslipDisableReason,
  useBaseBetslip,
  useBet,
  useBetFee,
  useChain,
  useConditionsState,
  useDetailedBetslip,
} from "@azuro-org/sdk";
import {
  BetRestrictionType,
  BonusStatus,
  ConditionState,
  FreebetType,
} from "@azuro-org/toolkit";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  useBalance,
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { explorerTxUrl } from "@/lib/chains";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { AZURO_AFFILIATE } from "@/lib/affiliate";
import dynamic from "next/dynamic";
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { useToast } from "@/components/Toast";
import {
  encodeSlipDecimalOdds,
  formatOddsValue,
  formatStoredOddsString,
  parseStoredDecimalOdds,
} from "@/lib/oddsFormat";
import { formatWalletTxError } from "@/lib/userFacingTxError";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { formatUsdFromDecimalString, useTokenUsdPrice } from "@/lib/price";
import {
  computeOddsDrift,
  initialMetaById,
  messageForBetslipDisableReason,
  metaByIdReducer,
  pruneMetaById,
  readPersistedBetslipMeta,
  selectionId,
  stakePresetsFor,
  usdToTokenString,
  USD_STAKE_PRESETS,
  writePersistedBetslipMeta,
  type BetslipMode,
  type BetslipSelection,
} from "@/components/betslipState";

// Re-exports preserved for the existing consumers
// (BetReceipt, OddsButton, GameCard, etc.).
export type { BetslipSelection };
export { selectionId };

const BetReceipt = dynamic(
  () =>
    import("@/components/BetReceipt").then((m) => ({ default: m.BetReceipt })),
  { ssr: false },
);

const MobileBetslipDrawer = dynamic(
  () =>
    import("@/components/MobileBetslipDrawer").then((m) => ({
      default: m.MobileBetslipDrawer,
    })),
  { ssr: false },
);

function BetslipMobileDrawerSlot() {
  const { open } = useBetslipMobileDrawer();
  if (!open) {
    return null;
  }
  return <MobileBetslipDrawer />;
}

type BetslipActionsValue = {
  addSelection: (item: {
    gameId: string;
    gameTitle: string;
    outcomeName: string;
    odds: string;
    conditionId: string;
    outcomeId: string;
    isExpressForbidden?: boolean;
    listConditionStateAtAdd?: ConditionState;
  }) => void;
  clearSelections: () => void;
  removeSelection: (id: string) => void;
  /** Update stored odds for selections to accept live price changes. */
  acceptOdds: (updates: Record<string, string>) => void;
};

type BetslipSelectionsValue = {
  selections: BetslipSelection[];
};

const BetslipActionsContext = createContext<BetslipActionsValue | null>(null);
const BetslipSelectionsContext = createContext<BetslipSelectionsValue | null>(
  null,
);

/** Set of `selectionId` values currently on the slip; updated by `BetslipProvider`. */
let betslipSelectionIdSnapshot: ReadonlySet<string> = new Set();
const betslipSelectionIdListeners = new Map<string, Set<() => void>>();

function subscribeBetslipSelectionId(id: string, onChange: () => void) {
  let set = betslipSelectionIdListeners.get(id);
  if (!set) {
    set = new Set();
    betslipSelectionIdListeners.set(id, set);
  }
  set.add(onChange);
  return () => {
    set!.delete(onChange);
    if (set!.size === 0) {
      betslipSelectionIdListeners.delete(id);
    }
  };
}

function setBetslipSelectionIdSnapshot(next: ReadonlySet<string>) {
  const prev = betslipSelectionIdSnapshot;
  betslipSelectionIdSnapshot = next;
  const changed = new Set<string>();
  for (const id of prev) {
    if (!next.has(id)) {
      changed.add(id);
    }
  }
  for (const id of next) {
    if (!prev.has(id)) {
      changed.add(id);
    }
  }
  for (const id of changed) {
    betslipSelectionIdListeners.get(id)?.forEach((cb) => {
      cb();
    });
  }
}

type BetslipMobileDrawerContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const BetslipMobileDrawerContext =
  createContext<BetslipMobileDrawerContextValue | null>(null);

export function useBetslipActions() {
  const ctx = useContext(BetslipActionsContext);
  if (!ctx) {
    throw new Error("useBetslipActions must be used within BetslipProvider");
  }
  return ctx;
}

export function useBetslipSelections() {
  const ctx = useContext(BetslipSelectionsContext);
  if (!ctx) {
    throw new Error("useBetslipSelections must be used within BetslipProvider");
  }
  return ctx;
}

/**
 * Subscribes only to whether this selection id is on the slip, so adding/removing
 * elsewhere does not re-render unrelated odds buttons.
 */
export function useBetslipSelectionSelected(selectionKey: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeBetslipSelectionId(selectionKey, onStoreChange),
    () => betslipSelectionIdSnapshot.has(selectionKey),
    () => false,
  );
}

export function useBetslipMobileDrawer() {
  const ctx = useContext(BetslipMobileDrawerContext);
  if (!ctx) {
    throw new Error("useBetslipMobileDrawer must be used within BetslipProvider");
  }
  return ctx;
}

export function BetslipProvider({ children }: { children: ReactNode }) {
  const { items, addItem, removeItem, clear } = useBaseBetslip();
  // Start empty on the server to keep SSR deterministic, then hydrate from
  // localStorage on mount. A bet placed right after load still works because
  // addSelection writes both React state and storage.
  const [metaById, dispatchMeta] = useReducer(metaByIdReducer, initialMetaById);
  useEffect(() => {
    const stored = readPersistedBetslipMeta();
    if (Object.keys(stored).length > 0) {
      // One-shot hydration after mount keeps SSR output (empty) and the first
      // client paint byte-identical, then back-fills from localStorage.
      dispatchMeta({ kind: "hydrate", stored });
    }
  }, []);
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

  // Keep module store in sync before descendants render (for `useBetslipSelectionSelected`).
  setBetslipSelectionIdSnapshot(validSelectionIds);

  const metaByIdSynced = useMemo(
    () => pruneMetaById(metaById, validSelectionIds),
    [metaById, validSelectionIds],
  );

  // Persist on every change so the slip survives refresh with real info
  // instead of "—" placeholders. The pruned map mirrors exactly what the
  // slip will render, so storage stays in lockstep with the UI.
  useEffect(() => {
    writePersistedBetslipMeta(metaByIdSynced);
  }, [metaByIdSynced]);

  // Auto-evict picks whose live condition is terminal (Canceled / Removed /
  // Resolved). Stopped is intentionally NOT included — it's a transient pause
  // that flips back to Active on a live-match flicker, and the SDK's
  // BetslipDisableReason.ConditionState gate self-clears when it does, so
  // there's no reason to drop the user's pick just to make them re-add it
  // seconds later. Terminal states really can't settle, though, so keeping
  // them on the slip is pure friction.
  const slipConditionIds = useMemo(
    () => Array.from(new Set(items.map((it) => it.conditionId))),
    [items],
  );
  const { data: slipLiveStates } = useConditionsState({
    conditionIds: slipConditionIds,
    initialStates: {},
  });
  useEffect(() => {
    for (const item of items) {
      const state = slipLiveStates[item.conditionId];
      if (
        state === ConditionState.Canceled ||
        state === ConditionState.Removed ||
        state === ConditionState.Resolved
      ) {
        removeItem({
          conditionId: item.conditionId,
          outcomeId: item.outcomeId,
        });
      }
    }
    // `removeItem` identity is stable from `useBaseBetslip`.
  }, [items, slipLiveStates, removeItem]);

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
      listConditionStateAtAdd?: ConditionState;
    }) => {
      const id = selectionId(item.gameId, item.outcomeName, item.outcomeId);
      // Standard sportsbook ergonomic: clicking an already-selected outcome
      // toggles it off. Saves the user a trip to the slip's × button for the
      // common "I mis-clicked / I changed my mind" case.
      const existing = items.find(
        (it) =>
          it.gameId === item.gameId && it.outcomeId === item.outcomeId,
      );
      if (existing) {
        removeItem({
          conditionId: existing.conditionId,
          outcomeId: existing.outcomeId,
        });
        dispatchMeta({ kind: "remove", id });
        return;
      }
      const row: BetslipSelection = {
        id,
        gameId: item.gameId,
        gameTitle: item.gameTitle,
        outcomeName: item.outcomeName,
        odds: item.odds,
        conditionId: item.conditionId,
        outcomeId: item.outcomeId,
        listConditionStateAtAdd: item.listConditionStateAtAdd,
      };
      dispatchMeta({ kind: "add", row });
      addItem({
        gameId: item.gameId,
        conditionId: item.conditionId,
        outcomeId: item.outcomeId,
        isExpressForbidden: item.isExpressForbidden ?? false,
      });
    },
    [addItem, items, removeItem],
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
        dispatchMeta({ kind: "remove", id });
      }
    },
    [metaByIdSynced, items, removeItem],
  );

  const clearSelections = useCallback(() => {
    clear();
    dispatchMeta({ kind: "clear" });
  }, [clear]);

  const acceptOdds = useCallback((updates: Record<string, string>) => {
    dispatchMeta({ kind: "acceptOdds", updates });
  }, []);

  const actionsValue = useMemo(
    () => ({ addSelection, removeSelection, clearSelections, acceptOdds }),
    [addSelection, removeSelection, clearSelections, acceptOdds],
  );

  const selectionsValue = useMemo(() => ({ selections }), [selections]);

  const mobileDrawer = useMemo(
    () => ({
      open: mobileDrawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [mobileDrawerOpen, openDrawer, closeDrawer],
  );

  return (
    <BetslipSelectionsContext.Provider value={selectionsValue}>
      <BetslipActionsContext.Provider value={actionsValue}>
        <BetslipMobileDrawerContext.Provider value={mobileDrawer}>
          {children}
          <BetslipMobileDrawerSlot />
        </BetslipMobileDrawerContext.Provider>
      </BetslipActionsContext.Provider>
    </BetslipSelectionsContext.Provider>
  );
}

const SLIPPAGE_PERCENT = 5;

function BetslipStakeAndPlace({ selections }: { selections: BetslipSelection[] }) {
  const { format: oddsFormat } = useOddsFormat();
  const { betToken } = useChain();
  const chainGuard = useAzuroActionChain();
  const {
    betAmount,
    changeBetAmount,
    odds: sdkOdds,
    totalOdds: sdkTotalOdds,
    disableReason,
    isBetAllowed,
    isStatesFetching,
    isOddsFetching,
    isBetCalculationFetching,
    minBet,
    maxBet,
    freebets,
    selectedFreebet,
    selectFreebet,
    isFreebetsFetching,
  } = useDetailedBetslip();
  const { data: betFeeData } = useBetFee();
  const { showToast } = useToast();
  const { clearSelections, acceptOdds } = useBetslipActions();
  const { address, isConnected } = useConnection();
  const {
    data: tokenBalanceRaw,
    refetch: refetchTokenBalance,
  } = useReadContract({
    address: betToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isConnected && betToken.address),
      // Keep the balance fresh while the slip is open so the insufficient-
      // balance gate stays accurate between bets without waiting on the SDK.
      refetchInterval: 15_000,
      staleTime: 0,
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

  const usdPerUnit = useTokenUsdPrice(chainGuard.appChainId, {
    address: betToken.address,
    symbol: betToken.symbol,
    decimals: betToken.decimals,
    // Sports betslip tokens are always the chain's wrapped-native / stablecoin
    // ERC-20, never the raw EOA-holdable native token. isNative=false is
    // correct; `isWrappedNative` logic in price.ts handles WETH et al.
    isNative: false,
  });
  const canShowUsd = usdPerUnit !== undefined && !selectedFreebet;
  const [inputCurrency, setInputCurrency] = useState<"token" | "usd">("token");
  // If we lose the price (e.g. after a chain switch) while in USD mode, fall
  // back to token mode so the input doesn't silently misrepresent the stake.
  useEffect(() => {
    if (inputCurrency === "usd" && !canShowUsd) setInputCurrency("token");
  }, [inputCurrency, canShowUsd]);

  const tokenPresets = useMemo(
    () => stakePresetsFor(betToken.symbol),
    [betToken.symbol],
  );

  const usdOfCurrentStake = useMemo(
    () => formatUsdFromDecimalString(betAmount || "0", usdPerUnit),
    [betAmount, usdPerUnit],
  );

  const stakeInputValue = useMemo(() => {
    if (inputCurrency === "token") return betAmount;
    if (!usdPerUnit || !betAmount) return "";
    const n = Number(betAmount);
    if (!Number.isFinite(n)) return "";
    const usd = n * usdPerUnit;
    return usd > 0 && usd < 0.01 ? "" : usd.toFixed(usd < 1 ? 4 : 2);
  }, [inputCurrency, betAmount, usdPerUnit]);

  const handleStakeInput = useCallback(
    (raw: string) => {
      if (inputCurrency === "token" || !usdPerUnit) {
        applyStake(raw);
        return;
      }
      applyStake(usdToTokenString(raw, usdPerUnit, betToken.decimals));
    },
    [inputCurrency, usdPerUnit, applyStake, betToken.decimals],
  );

  const handlePresetClick = useCallback(
    (preset: string) => {
      if (inputCurrency === "token" || !usdPerUnit) {
        applyStake(preset);
        return;
      }
      applyStake(usdToTokenString(preset, usdPerUnit, betToken.decimals));
    },
    [inputCurrency, usdPerUnit, applyStake, betToken.decimals],
  );

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

  // `useAvailableFreebets` server-filters by selections but keeps expired /
  // used / bet-type-restricted bonuses in the list. Hide them from the UI so
  // users don't pick something the relayer will reject at submit time.
  const isComboBet = multiPick && mode === "combo";
  const applicableFreebets = useMemo(() => {
    if (!freebets) return [];
    const now = Date.now();
    return freebets.filter((fb) => {
      if (fb.status !== BonusStatus.Available) return false;
      if (fb.expiresAt <= now) return false;
      const restriction = fb.settings.betRestriction.type;
      if (restriction === BetRestrictionType.Ordinar && isComboBet) return false;
      if (restriction === BetRestrictionType.Combo && !isComboBet) return false;
      return true;
    });
  }, [freebets, isComboBet]);

  // When the previously-selected freebet is no longer applicable (e.g. user
  // switched single↔combo, or it expired while the slip was open), drop it
  // so `useBet` doesn't submit a stale freebet id.
  useEffect(() => {
    if (!selectedFreebet) return;
    const stillApplicable = applicableFreebets.some(
      (f) => f.id === selectedFreebet.id,
    );
    if (!stillApplicable) {
      selectFreebet(undefined);
    }
  }, [applicableFreebets, selectedFreebet, selectFreebet]);

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

  // Effective odds: prefer live SDK values, fall back to the price captured at
  // add-to-slip time. Azuro's `condition-batch` upstream is 7–10s per call, and
  // `useOdds` starts with an empty map → betslip would show "loading" for that
  // whole window. The user already clicked a confirmed price on the list card;
  // trust it, and let the drift banner catch real price moves once the SDK
  // eventually returns.
  const effectiveOddsRecord = useMemo(() => {
    const o: Record<string, number> = {};
    for (const s of activeSelections) {
      const key = `${s.conditionId}-${s.outcomeId}`;
      const live = sdkOdds[key];
      if (typeof live === "number" && Number.isFinite(live) && live > 0) {
        o[key] = live;
        continue;
      }
      const stored = parseStoredDecimalOdds(s.odds);
      if (stored != null && stored > 0) {
        o[key] = stored;
      } else {
        return null;
      }
    }
    return o;
  }, [activeSelections, sdkOdds]);

  const effectiveTotalOdds = useMemo(() => {
    if (!activeSelections.length || !effectiveOddsRecord) {
      return 0;
    }
    // Single-mode on a multi-pick slip places per-leg: use raw leg odds.
    if (mode === "single" && multiPick) {
      const s = activeSelections[0]!;
      return effectiveOddsRecord[`${s.conditionId}-${s.outcomeId}`] ?? 0;
    }
    // Combo (incl. 1-pick default): the SDK's `useOdds.totalOdds` always applies
    // the `ODDS_COMBO_FEE_MODIFIER` (0.99). Mirror that in the fallback so the
    // submit-time minOdds and potential-win display stay consistent with what
    // the SDK would have computed.
    if (
      typeof sdkTotalOdds === "number" &&
      Number.isFinite(sdkTotalOdds) &&
      sdkTotalOdds > 1
    ) {
      return sdkTotalOdds;
    }
    let prod = 1;
    for (const s of activeSelections) {
      const v = effectiveOddsRecord[`${s.conditionId}-${s.outcomeId}`];
      if (!v) return 0;
      prod *= v;
    }
    return prod * 0.99;
  }, [activeSelections, effectiveOddsRecord, mode, multiPick, sdkTotalOdds]);

  /** Combined odds for display — stays consistent with what we'll submit. */
  const totalOddsDisplay = effectiveTotalOdds;

  const stakeAmount = betAmount.trim();
  const stakeNum = Number.parseFloat(stakeAmount);
  const stakeValid = Number.isFinite(stakeNum) && stakeNum > 0;

  // Pre-submit balance guard: without this, users with too little token
  // balance hit the Azuro relayer's generic "Condition is not active" /
  // "BadData" branch (relayer validates condition state before funds) and
  // never see the real problem. Free bets don't debit the wallet; skip.
  const stakeWei = (() => {
    if (!stakeValid || selectedFreebet) return null;
    try {
      return parseUnits(stakeAmount, betToken.decimals);
    } catch {
      return null;
    }
  })();
  const relayerFeeWei = betFeeData?.relayerFeeAmount ?? 0n;
  const requiredWei = stakeWei != null ? stakeWei + relayerFeeWei : null;
  const hasInsufficientBalance =
    isConnected &&
    !selectedFreebet &&
    requiredWei != null &&
    tokenBalanceRaw != null &&
    requiredWei > tokenBalanceRaw;
  const formattedBalance =
    tokenBalanceRaw != null
      ? formatUnits(tokenBalanceRaw, betToken.decimals)
      : null;

  // ---- One-click wrap (ETH→WETH / xDAI→WXDAI / etc.) ----
  // Sports bets settle in a wrapped native on most chains, but wallets usually
  // hold the raw native token. If the user is short on the wrapped ERC-20 but
  // has enough native to cover the shortfall, offer to call deposit() on the
  // wrapped-native contract before they try to bet.
  const isWrappableSymbol = /^W(ETH|MATIC|POL|AVAX|XDAI)$/i.test(
    betToken.symbol,
  );
  const nativeSymbol = isWrappableSymbol
    ? betToken.symbol.replace(/^W/i, "")
    : "";
  // `chainGuard.appChainId` is Azuro's broad chain union — narrow to the
  // wagmi-config subset via a numeric cast so the hook types type-check.
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chainId: chainGuard.appChainId as any,
    query: {
      enabled: Boolean(isWrappableSymbol && address && isConnected),
      refetchInterval: 15_000,
      staleTime: 0,
    },
  });
  const wrapShortfallWei =
    hasInsufficientBalance && requiredWei != null && tokenBalanceRaw != null
      ? requiredWei - tokenBalanceRaw
      : null;
  const canWrap =
    isWrappableSymbol &&
    wrapShortfallWei != null &&
    wrapShortfallWei > BigInt(0) &&
    (nativeBalance?.value ?? BigInt(0)) >= wrapShortfallWei;
  // Wrap flow has four distinct UI states, each needing a different status
  // so the user always knows what's actually happening:
  //   idle                → "Wrap X ETH → WETH" (call to action)
  //   waitingWallet       → "Confirm in wallet…" (between click and MM sign)
  //   broadcast + pending → "Wrapping… · view tx" (tx submitted, mining)
  //   confirmed           → banner hides, balances refetched automatically
  const [wrapTxHash, setWrapTxHash] = useState<`0x${string}` | undefined>();
  const [wrapWaitingWallet, setWrapWaitingWallet] = useState(false);
  const { writeContractAsync: writeWrapAsync } = useWriteContract();
  const { isLoading: wrapReceiptLoading, isSuccess: wrapReceiptSuccess } =
    useWaitForTransactionReceipt({
      hash: wrapTxHash,
      query: { enabled: Boolean(wrapTxHash) },
    });
  const wrapping = wrapWaitingWallet || Boolean(wrapTxHash && wrapReceiptLoading);
  useEffect(() => {
    if (!wrapReceiptSuccess) return;
    // Give the node a beat so the refetch returns the post-deposit balance.
    const id = window.setTimeout(() => {
      void refetchTokenBalance();
      void refetchNativeBalance();
      setWrapTxHash(undefined);
    }, 600);
    return () => window.clearTimeout(id);
  }, [wrapReceiptSuccess, refetchTokenBalance, refetchNativeBalance]);
  const handleWrap = useCallback(async () => {
    if (!canWrap || wrapShortfallWei == null) return;
    setErrorMessage(null);
    setWrapWaitingWallet(true);
    try {
      const hash = await writeWrapAsync({
        address: betToken.address,
        abi: [
          {
            type: "function",
            name: "deposit",
            stateMutability: "payable",
            inputs: [],
            outputs: [],
          },
        ] as const,
        functionName: "deposit",
        value: wrapShortfallWei,
      });
      setWrapTxHash(hash);
    } catch (e) {
      setErrorMessage(formatWalletTxError(e));
    } finally {
      setWrapWaitingWallet(false);
    }
  }, [canWrap, wrapShortfallWei, betToken.address, writeWrapAsync]);

  const singleLegEffective =
    multiPick && mode === "single" && activeSelections[0] && effectiveOddsRecord
      ? effectiveOddsRecord[
          `${activeSelections[0].conditionId}-${activeSelections[0].outcomeId}`
        ]
      : undefined;
  const potentialWinSingleLeg =
    stakeValid &&
    typeof singleLegEffective === "number" &&
    Number.isFinite(singleLegEffective) &&
    singleLegEffective > 0
      ? stakeNum * singleLegEffective
      : null;

  const potentialWinCombo =
    mode === "combo" && stakeValid && effectiveTotalOdds > 0
      ? stakeNum * effectiveTotalOdds
      : null;

  const potentialWinDisplay =
    mode === "combo" ? potentialWinCombo : potentialWinSingleLeg;

  // Hold last-known-good values so the UI doesn't flash "—" during SDK refetches.
  const stableMinBetRef = useRef(minBet);
  const stableMaxBetRef = useRef(maxBet);
  const stablePotentialWinRef = useRef(potentialWinDisplay);
  const stableFeeRef = useRef(betFeeData?.formattedRelayerFeeAmount);
  if ((minBet ?? 0) > 0) stableMinBetRef.current = minBet;
  if ((maxBet ?? 0) > 0) stableMaxBetRef.current = maxBet;
  if (potentialWinDisplay != null) stablePotentialWinRef.current = potentialWinDisplay;
  if (betFeeData?.formattedRelayerFeeAmount) stableFeeRef.current = betFeeData.formattedRelayerFeeAmount;

  const stableMinBet = minBet ?? stableMinBetRef.current;
  const stableMaxBet = maxBet ?? stableMaxBetRef.current;
  const stablePotentialWin = potentialWinDisplay ?? stablePotentialWinRef.current;
  const stableFee = betFeeData?.formattedRelayerFeeAmount ?? stableFeeRef.current;

  const receiptTotalOdds = effectiveTotalOdds;

  const oddsDrift = useMemo(
    () =>
      computeOddsDrift(
        activeSelections,
        sdkOdds,
        typeof sdkTotalOdds === "number" &&
          Number.isFinite(sdkTotalOdds) &&
          sdkTotalOdds > 0
          ? sdkTotalOdds
          : 0,
        mode,
        multiPick,
      ),
    [activeSelections, sdkOdds, sdkTotalOdds, mode, multiPick],
  );

  const [pauseGraceElapsed, setPauseGraceElapsed] = useState(false);
  useEffect(() => {
    const soft =
      disableReason === BetslipDisableReason.ConditionState &&
      (isOddsFetching || isBetCalculationFetching);
    if (!soft) {
      setPauseGraceElapsed(false);
      return;
    }
    setPauseGraceElapsed(false);
    const id = window.setTimeout(() => setPauseGraceElapsed(true), 800);
    return () => window.clearTimeout(id);
  }, [disableReason, isOddsFetching, isBetCalculationFetching]);

  const sdkDisableMessage = useMemo(() => {
    // While condition states are loading, the SDK often reports ConditionState — avoid
    // alarming "paused" copy on live games (Azuro useConditionsState lags the list card).
    if (
      disableReason === BetslipDisableReason.ConditionState &&
      isStatesFetching
    ) {
      return "Checking market availability…";
    }
    if (
      disableReason === BetslipDisableReason.ConditionState &&
      (isOddsFetching || isBetCalculationFetching) &&
      !pauseGraceElapsed
    ) {
      return "Checking market availability…";
    }
    // SDK's useOdds starts with an empty odds map, which makes totalOdds resolve to
    // ~0.99 via calcMinOdds's combo-fee modifier → disableReason = TotalOddsTooLow
    // even though the selection is perfectly fine. Show loading copy until the first
    // odds update lands, so users don't see a scary "odds too low" while picks resolve.
    if (
      disableReason === BetslipDisableReason.TotalOddsTooLow &&
      (isOddsFetching || isBetCalculationFetching || isStatesFetching)
    ) {
      return "Loading odds…";
    }
    // SDK maps !isMaxBetBiggerThanZero to SelectedOutcomesTemporarySuspended (misnamed).
    if (
      disableReason ===
        BetslipDisableReason.SelectedOutcomesTemporarySuspended &&
      (isBetCalculationFetching || (maxBet ?? 0) <= 0)
    ) {
      return isBetCalculationFetching
        ? "Loading bet limits for this slip…"
        : "The contract returned no max stake for this slip yet. Wait a moment, lower your stake, or re-add the pick from the live game page.";
    }
    return messageForBetslipDisableReason(disableReason);
  }, [
    disableReason,
    isStatesFetching,
    isOddsFetching,
    isBetCalculationFetching,
    pauseGraceElapsed,
    maxBet,
  ]);

  const betslipDebug = process.env.NEXT_PUBLIC_BETSLIP_DEBUG === "1";
  const betslipDebugLoggedKey = useRef("");
  useEffect(() => {
    if (!betslipDebug) {
      return;
    }
    if (
      disableReason !== BetslipDisableReason.ConditionState ||
      !pauseGraceElapsed
    ) {
      betslipDebugLoggedKey.current = "";
      return;
    }
    const key = activeSelections
      .map((s) => `${s.conditionId}:${s.outcomeId}`)
      .join("|");
    if (betslipDebugLoggedKey.current === key) {
      return;
    }
    betslipDebugLoggedKey.current = key;
    console.info("[betslip-debug]", {
      disableReason,
      isStatesFetching,
      isOddsFetching,
      isBetCalculationFetching,
      legs: activeSelections.map((s) => ({
        gameId: s.gameId,
        conditionId: s.conditionId,
        outcomeId: s.outcomeId,
        listConditionStateAtAdd: s.listConditionStateAtAdd,
      })),
    });
  }, [
    betslipDebug,
    disableReason,
    pauseGraceElapsed,
    activeSelections,
    isOddsFetching,
    isBetCalculationFetching,
    isStatesFetching,
  ]);

  const pausedConditionBlocking =
    disableReason === BetslipDisableReason.ConditionState &&
    pauseGraceElapsed &&
    !isBetAllowed;
  const [showPauseBannerRemove, setShowPauseBannerRemove] = useState(false);
  useEffect(() => {
    if (!pausedConditionBlocking) {
      setShowPauseBannerRemove(false);
      return;
    }
    setShowPauseBannerRemove(false);
    const id = window.setTimeout(() => setShowPauseBannerRemove(true), 3_000);
    return () => window.clearTimeout(id);
  }, [pausedConditionBlocking]);

  const { submit, approveTx, betTx, isApproveRequired } =
    useBet({
      betAmount: stakeValid ? stakeAmount : "0",
      slippage: SLIPPAGE_PERCENT,
      affiliate: AZURO_AFFILIATE,
      freebet: selectedFreebet,
      selections: sdkSelections,
      odds: effectiveOddsRecord ?? {},
      totalOdds: effectiveTotalOdds,
      onSuccess: (receipt) => {
        setErrorMessage(null);
        // Force an immediate balance re-read so the next bet's
        // insufficient-balance gate compares against post-bet funds.
        // The 15s refetchInterval would catch up eventually; this closes
        // the window where the user opens another slip mid-interval.
        void refetchTokenBalance();
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
        setErrorMessage(formatWalletTxError(err ?? new Error("Could not place bet.")));
      },
    });

  const isBusy =
    approveTx.isPending ||
    approveTx.isProcessing ||
    betTx.isPending ||
    betTx.isProcessing;

  // SDK's `useOdds` and `useConditionsState` both hit the slow
  // `condition-batch` upstream (7–10s). While they're loading:
  //   - `sdkOdds = {}` → `totalOdds = 0.99` → `TotalOddsTooLow` (spurious)
  //   - `states = {}` → `isConditionsInActiveState = true` (vacuous ∀-check)
  // So with a valid `effectiveOddsRecord` the only SDK-hydration blocker is
  // the `TotalOddsTooLow` quirk. Bypass it and drop the `!isStatesFetching`
  // wait entirely — once states land, a real pause surfaces as
  // `disableReason = ConditionState` and re-gates the button. Same story for
  // `!isBetCalculationFetching`: the SDK treats undefined `maxBet` as
  // unbounded and the relayer enforces limits on submit.
  const isOddsHydrationQuirk =
    disableReason === BetslipDisableReason.TotalOddsTooLow && isOddsFetching;

  const canSubmitRaw =
    stakeValid &&
    effectiveOddsRecord !== null &&
    effectiveTotalOdds > 1 &&
    isConnected &&
    Boolean(address) &&
    !isBusy &&
    !hasInsufficientBalance &&
    (isBetAllowed || isOddsHydrationQuirk);

  // Stabilise the enabled state: once disabled, hold for 200ms before
  // re-enabling to prevent single-frame flicker on live condition transitions.
  const [canSubmitStable, setCanSubmitStable] = useState(canSubmitRaw);
  useEffect(() => {
    if (canSubmitRaw) {
      const id = window.setTimeout(() => setCanSubmitStable(true), 200);
      return () => window.clearTimeout(id);
    }
    setCanSubmitStable(false);
  }, [canSubmitRaw]);

  const canSubmit = canSubmitStable;

  const placeBetLabel =
    isApproveRequired && !hasInsufficientBalance
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
      {applicableFreebets.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium text-zinc-400"
            htmlFor="betslip-freebet"
          >
            Bonus
          </label>
          <select
            id="betslip-freebet"
            value={selectedFreebet ? String(selectedFreebet.id) : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                selectFreebet(undefined);
                return;
              }
              const fb = applicableFreebets.find((f) => String(f.id) === v);
              selectFreebet(fb);
            }}
            disabled={isFreebetsFetching}
            className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 md:min-h-0"
          >
            <option value="">Pay with wallet</option>
            {applicableFreebets.map((f) => {
              const kind =
                f.settings.type === FreebetType.AllWin
                  ? "full payout"
                  : "profit only";
              return (
                <option key={String(f.id)} value={String(f.id)}>
                  Free bet {f.amount} {betToken.symbol} · {kind}
                </option>
              );
            })}
          </select>
          {selectedFreebet ? (
            <p className="text-xs text-zinc-500">
              Stake is set by the free bet. Choose “Pay with wallet” to use your
              balance instead.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <label
          className="text-xs font-medium text-zinc-400"
          htmlFor="betslip-stake"
        >
          Stake ({inputCurrency === "usd" ? "USD" : betToken.symbol})
        </label>
        {canShowUsd ? (
          <div className="flex rounded-md border border-zinc-700 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setInputCurrency("token")}
              className={`rounded-sm px-2 py-0.5 transition ${
                inputCurrency === "token"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {betToken.symbol}
            </button>
            <button
              type="button"
              onClick={() => setInputCurrency("usd")}
              className={`rounded-sm px-2 py-0.5 transition ${
                inputCurrency === "usd"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              $
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {(inputCurrency === "usd" ? USD_STAKE_PRESETS : tokenPresets).map(
          (preset) => (
            <button
              key={preset}
              type="button"
              disabled={Boolean(selectedFreebet)}
              onClick={() => handlePresetClick(preset)}
              className="min-h-9 min-w-[2.75rem] touch-manipulation rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium tabular-nums text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 active:bg-zinc-800/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inputCurrency === "usd" ? `$${preset}` : preset}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={fillMaxStake}
          disabled={
            Boolean(selectedFreebet) ||
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
          placeholder={inputCurrency === "usd" ? "$0" : "0"}
          value={stakeInputValue}
          readOnly={Boolean(selectedFreebet)}
          onChange={(e) => handleStakeInput(e.target.value)}
          className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 read-only:cursor-not-allowed read-only:bg-zinc-900/80 read-only:text-zinc-400 md:min-h-0 md:text-sm"
        />
      </div>
      {canShowUsd && betAmount && Number(betAmount) > 0 ? (
        <p className="text-[11px] tabular-nums text-zinc-500">
          {inputCurrency === "usd"
            ? `≈ ${betAmount} ${betToken.symbol}`
            : usdOfCurrentStake
              ? `≈ ${usdOfCurrentStake}`
              : null}
        </p>
      ) : null}
      {isConnected &&
      activeSelections.length > 0 &&
      ((stableMinBet ?? 0) > 0 || (stableMaxBet ?? 0) > 0) ? (
        <p className="text-xs text-zinc-500">
          Allowed stake:{" "}
          <span className="font-mono tabular-nums text-zinc-400">
            {[
              (stableMinBet ?? 0) > 0 ? `min ${stableMinBet}` : null,
              (stableMaxBet ?? 0) > 0 ? `max ${stableMaxBet}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>{" "}
          {betToken.symbol}
        </p>
      ) : null}
      {isConnected &&
      !selectedFreebet &&
      stableFee ? (
        <p className="text-xs text-zinc-500">
          Est. relayer fee:{" "}
          <span className="font-mono tabular-nums text-zinc-400">
            {stableFee} {betToken.symbol}
          </span>
        </p>
      ) : null}
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
          {stablePotentialWin != null
            ? `${stablePotentialWin.toFixed(2)} ${betToken.symbol}`
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
      {isApproveRequired && !hasInsufficientBalance ? (
        <p className="text-xs text-amber-500/90">
          Approve {betToken.symbol} for the relayer, then tap Place Bet again to
          confirm.
        </p>
      ) : null}
      {!isConnected ? (
        <p className="text-xs text-zinc-500">Connect a wallet to place a bet.</p>
      ) : null}
      {hasInsufficientBalance ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
          role="status"
          aria-live="polite"
        >
          <p>
            Not enough {betToken.symbol} for this stake. Your balance is{" "}
            <span className="font-semibold tabular-nums">
              {formattedBalance ?? "0"}
            </span>{" "}
            {betToken.symbol}.{" "}
            {canWrap
              ? `You have enough ${nativeSymbol} to wrap the shortfall.`
              : "Lower the stake or top up your wallet."}
          </p>
          {canWrap && wrapShortfallWei != null ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={wrapping}
                onClick={() => void handleWrap()}
                className="self-start rounded-md border border-amber-600 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-800/60 disabled:cursor-wait disabled:opacity-60"
              >
                {wrapWaitingWallet
                  ? `Confirm in wallet…`
                  : wrapTxHash && wrapReceiptLoading
                    ? `Wrapping ${nativeSymbol}…`
                    : `Wrap ${formatUnits(wrapShortfallWei, betToken.decimals)} ${nativeSymbol} → ${betToken.symbol}`}
              </button>
              {wrapTxHash ? (() => {
                const url = explorerTxUrl(chainGuard.appChainId, wrapTxHash);
                return (
                  <p className="text-[11px] text-amber-200/80">
                    {wrapReceiptLoading
                      ? "Waiting for on-chain confirmation… "
                      : wrapReceiptSuccess
                        ? "Wrap confirmed — refreshing balance… "
                        : "Tx submitted. "}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-amber-100"
                      >
                        View tx
                      </a>
                    ) : null}
                  </p>
                );
              })() : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {isConnected &&
      sdkDisableMessage &&
      !isBetAllowed &&
      !isOddsHydrationQuirk ? (
        <div
          className="rounded-md border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
          role="status"
          aria-live="polite"
        >
          <p>{sdkDisableMessage}</p>
          {showPauseBannerRemove ? (
            <button
              type="button"
              className="mt-2 rounded border border-amber-700/80 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-900/50"
              onClick={() => clearSelections()}
            >
              Remove all picks
            </button>
          ) : null}
        </div>
      ) : null}
      {errorMessage ? (
        <p
          className="rounded-md border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {isConnected &&
      activeSelections.length > 0 &&
      oddsDrift.hasDrift &&
      !isStatesFetching &&
      !isOddsFetching &&
      !isBetCalculationFetching &&
      isBetAllowed ? (
        <div
          className="rounded-md border border-amber-800/80 bg-amber-950/35 px-3 py-2 text-xs text-amber-100"
          role="status"
          aria-live="polite"
          aria-relevant="additions text"
        >
          <span className="font-medium text-amber-50">Odds updated.</span>{" "}
          Prices no longer match when you added these picks. Accept the new
          odds to continue.
          <span className="block pt-1 font-mono text-[11px] leading-snug text-amber-200/90 whitespace-pre-line">
            {oddsDrift.summary}
          </span>
          <button
            type="button"
            className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-500"
            onClick={() => {
              const updates: Record<string, string> = {};
              for (const sel of activeSelections) {
                const liveOdds = sdkOdds?.[`${sel.conditionId}-${sel.outcomeId}`];
                if (typeof liveOdds === "number" && liveOdds > 0) {
                  updates[sel.id] = encodeSlipDecimalOdds(liveOdds);
                }
              }
              acceptOdds(updates);
            }}
          >
            Accept new odds
          </button>
        </div>
      ) : null}
      {isConnected && !chainGuard.onBetChain ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-amber-300/90">
            This match settles on{" "}
            <span className="font-semibold">{chainGuard.appChainName}</span>.
            Your wallet is on{" "}
            <span className="font-semibold">{chainGuard.walletChainName}</span>{" "}
            — switch to place the bet.
          </p>
          <button
            type="button"
            disabled={chainGuard.switchPending}
            onClick={async () => {
              try {
                await chainGuard.switchToAppChain();
              } catch (e) {
                showToast(formatWalletTxError(e), "error");
              }
            }}
            className="min-h-11 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-[background-color,transform,opacity] duration-200 ease-out hover:scale-[1.02] hover:bg-amber-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0 md:py-2"
          >
            {chainGuard.switchPending
              ? `Switching to ${chainGuard.appChainName}…`
              : `Switch wallet to ${chainGuard.appChainName}`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canSubmit || oddsDrift.hasDrift}
          onClick={() => {
            if (!canSubmit || oddsDrift.hasDrift) return;
            void submit();
          }}
          className="min-h-11 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-[background-color,transform,opacity] duration-200 ease-out hover:scale-[1.02] hover:bg-amber-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 md:min-h-0 md:py-2"
        >
          {isBusy ? "Working…" : placeBetLabel}
        </button>
      )}
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
  const { selections } = useBetslipSelections();
  const { removeSelection } = useBetslipActions();

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
