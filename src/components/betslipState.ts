/**
 * Pure state logic for the Betslip — extracted so it can be tested without
 * rendering the React tree or stubbing the Azuro SDK / wagmi.
 *
 * Anything in here must stay framework-free (no React, no wagmi, no DOM
 * APIs except where guarded by `typeof window !== "undefined"`).
 */
import { BetslipDisableReason } from "@azuro-org/sdk";
import type { ConditionState } from "@azuro-org/toolkit";
import {
  formatDriftDecimalPair,
  oddsDriftedFromStored,
  parseStoredDecimalOdds,
} from "@/lib/oddsFormat";

// ─── types ─────────────────────────────────────────────────────────────────

export type BetslipSelection = {
  id: string;
  gameId: string;
  /** Match / event title shown on the receipt (e.g. Team A vs Team B). */
  gameTitle: string;
  outcomeName: string;
  odds: string;
  conditionId: string;
  outcomeId: string;
  /** Condition state when the pick was added from a list card (dev diagnostics). */
  listConditionStateAtAdd?: ConditionState;
};

export type BetslipMode = "single" | "combo";

export type OddsDriftInfo = { hasDrift: boolean; summary: string };

export type MetaById = Record<string, BetslipSelection>;

// ─── selection id ──────────────────────────────────────────────────────────

/** Stable id for a slip row. Falls back to outcomeName when outcomeId is absent
 *  (legacy code paths) so the same selection always hashes to the same key. */
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

// ─── presets ───────────────────────────────────────────────────────────────

/** Token-native quick-stake presets, keyed by token symbol. Falls back to
 *  `TOKEN_PRESETS_FALLBACK` when the bet token isn't in the map. Kept in the
 *  token's own units (ETH: 0.001–0.05, stablecoins: 5–50, etc.) so presets
 *  are sensible regardless of USD price. */
export const TOKEN_PRESETS_BY_SYMBOL: Record<string, readonly string[]> = {
  ETH: ["0.001", "0.005", "0.01", "0.05"],
  WETH: ["0.001", "0.005", "0.01", "0.05"],
  AVAX: ["0.1", "0.5", "1", "5"],
  WAVAX: ["0.1", "0.5", "1", "5"],
  POL: ["1", "5", "10", "50"],
  WPOL: ["1", "5", "10", "50"],
  MATIC: ["1", "5", "10", "50"],
  WMATIC: ["1", "5", "10", "50"],
  xDAI: ["1", "5", "10", "50"],
  WXDAI: ["1", "5", "10", "50"],
  USDC: ["5", "10", "25", "50"],
  "USDC.E": ["5", "10", "25", "50"],
  USDT: ["5", "10", "25", "50"],
  USDt: ["5", "10", "25", "50"],
  "USDT.E": ["5", "10", "25", "50"],
  DAI: ["5", "10", "25", "50"],
  LINK: ["0.5", "1", "5", "10"],
};

export const TOKEN_PRESETS_FALLBACK = ["5", "10", "25", "50"] as const;

/** USD-denominated presets used when the user toggles the stake input to $. */
export const USD_STAKE_PRESETS = ["5", "10", "25", "50"] as const;

export function stakePresetsFor(symbol: string): readonly string[] {
  return TOKEN_PRESETS_BY_SYMBOL[symbol] ?? TOKEN_PRESETS_FALLBACK;
}

/** Convert a USD string like "10" or "$10.50" to a token-decimal string. */
export function usdToTokenString(
  usdStr: string,
  usdPerUnit: number,
  decimals: number,
): string {
  const clean = usdStr.replace(/^\$/, "").trim();
  if (!clean) return "";
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0 || usdPerUnit <= 0) return "";
  const tokens = n / usdPerUnit;
  // Cap decimals at the token's max to avoid parseUnits rounding errors later.
  const max = Math.min(Math.max(decimals, 2), 8);
  return tokens.toFixed(max).replace(/\.?0+$/, "");
}

// ─── odds drift ────────────────────────────────────────────────────────────

export function computeOddsDrift(
  activeSelections: BetslipSelection[],
  sdkOdds: Record<string, number>,
  sdkTotalOdds: number,
  mode: BetslipMode,
  multiPick: boolean,
): OddsDriftInfo {
  const parts: string[] = [];
  for (const s of activeSelections) {
    const key = `${s.conditionId}-${s.outcomeId}`;
    const live = sdkOdds[key];
    const locked = parseStoredDecimalOdds(s.odds);
    if (
      locked == null ||
      typeof live !== "number" ||
      !Number.isFinite(live) ||
      live <= 0
    ) {
      continue;
    }
    if (oddsDriftedFromStored(locked, live)) {
      parts.push(
        `• ${s.outcomeName}: ${formatDriftDecimalPair(locked, live)} (decimal)`,
      );
    }
  }
  if (
    multiPick &&
    mode === "combo" &&
    activeSelections.length > 1 &&
    Number.isFinite(sdkTotalOdds) &&
    sdkTotalOdds > 0
  ) {
    let prod = 1;
    for (const s of activeSelections) {
      const d = parseStoredDecimalOdds(s.odds);
      if (d == null) {
        prod = NaN;
        break;
      }
      prod *= d;
    }
    if (
      Number.isFinite(prod) &&
      prod > 0 &&
      oddsDriftedFromStored(prod, sdkTotalOdds)
    ) {
      parts.push(
        `• Combined price: ${formatDriftDecimalPair(prod, sdkTotalOdds)} (decimal)`,
      );
    }
  }
  return {
    hasDrift: parts.length > 0,
    summary: parts.join("\n"),
  };
}

// ─── disable-reason copy ───────────────────────────────────────────────────

export function messageForBetslipDisableReason(
  reason: BetslipDisableReason | undefined,
): string | null {
  if (reason == null) {
    return null;
  }
  switch (reason) {
    case BetslipDisableReason.ConditionState:
      return "This market is paused — it will auto-unlock when it reopens.";
    case BetslipDisableReason.BetAmountGreaterThanMaxBet:
      return "Stake is above the maximum allowed for this bet.";
    case BetslipDisableReason.BetAmountLowerThanMinBet:
      return "Stake is below the minimum for this bet.";
    case BetslipDisableReason.ComboWithForbiddenItem:
      return "This combo includes a selection that cannot be combined. Remove a leg or bet singles.";
    case BetslipDisableReason.ComboWithSameGame:
      return "Combo cannot include more than one outcome from the same game.";
    case BetslipDisableReason.SelectedOutcomesTemporarySuspended:
      return "One or more selections are temporarily unavailable, or the contract has not returned a max stake yet.";
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

// ─── localStorage persistence ──────────────────────────────────────────────

export const BETSLIP_META_STORAGE_KEY = "elies:betslip:meta:v1";

/** Validate one persisted row. Used both at read time and (defensively) when
 *  hydrating into the reducer. */
export function isPersistedBetslipSelection(
  v: unknown,
): v is BetslipSelection {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<BetslipSelection>;
  return (
    typeof r.id === "string" &&
    typeof r.gameId === "string" &&
    typeof r.gameTitle === "string" &&
    typeof r.outcomeName === "string" &&
    typeof r.odds === "string" &&
    typeof r.conditionId === "string" &&
    typeof r.outcomeId === "string"
  );
}

export function readPersistedBetslipMeta(): MetaById {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BETSLIP_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: MetaById = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPersistedBetslipSelection(v)) {
        out[k] = {
          id: v.id,
          gameId: v.gameId,
          gameTitle: v.gameTitle,
          outcomeName: v.outcomeName,
          odds: v.odds,
          conditionId: v.conditionId,
          outcomeId: v.outcomeId,
          listConditionStateAtAdd: v.listConditionStateAtAdd,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writePersistedBetslipMeta(meta: MetaById) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      BETSLIP_META_STORAGE_KEY,
      JSON.stringify(meta),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

// ─── metaById reducer ──────────────────────────────────────────────────────

/**
 * Discriminated union of every state transition the Betslip's local row map
 * goes through. Adding a new arm fails the typecheck at `assertNever` until
 * the reducer is updated, so the state machine cannot silently miss an action.
 */
export type MetaByIdAction =
  | { kind: "hydrate"; stored: MetaById }
  | { kind: "add"; row: BetslipSelection }
  | { kind: "remove"; id: string }
  | { kind: "clear" }
  | { kind: "acceptOdds"; updates: Record<string, string> };

export const initialMetaById: MetaById = {};

export function metaByIdReducer(
  state: MetaById,
  action: MetaByIdAction,
): MetaById {
  switch (action.kind) {
    case "hydrate": {
      // Local edits win when the slip already has rows (the user has been
      // interacting since mount); otherwise lay down the persisted snapshot.
      const storedKeys = Object.keys(action.stored);
      if (storedKeys.length === 0) return state;
      if (Object.keys(state).length === 0) return action.stored;
      return { ...action.stored, ...state };
    }
    case "add": {
      return { ...state, [action.row.id]: action.row };
    }
    case "remove": {
      if (!(action.id in state)) return state;
      const next = { ...state };
      delete next[action.id];
      return next;
    }
    case "clear": {
      if (Object.keys(state).length === 0) return state;
      return {};
    }
    case "acceptOdds": {
      const ids = Object.keys(action.updates);
      if (ids.length === 0) return state;
      let touched = false;
      const next: MetaById = { ...state };
      for (const id of ids) {
        const odds = action.updates[id];
        if (typeof odds !== "string") continue;
        const row = next[id];
        if (!row || row.odds === odds) continue;
        next[id] = { ...row, odds };
        touched = true;
      }
      return touched ? next : state;
    }
    default: {
      assertNever(action);
      return state;
    }
  }
}

/** Filters `state` down to the rows whose id is still on the live slip.
 *  Returns the same reference when nothing changed so React can bail out. */
export function pruneMetaById(
  state: MetaById,
  validIds: ReadonlySet<string>,
): MetaById {
  const keys = Object.keys(state);
  if (keys.length === 0) return state;
  let allValid = true;
  for (const k of keys) {
    if (!validIds.has(k)) {
      allValid = false;
      break;
    }
  }
  if (allValid) return state;
  const next: MetaById = {};
  for (const k of keys) {
    if (validIds.has(k)) {
      next[k] = state[k]!;
    }
  }
  return next;
}

function assertNever(x: never): never {
  throw new Error(
    `metaByIdReducer: unhandled action ${JSON.stringify(x)}`,
  );
}
