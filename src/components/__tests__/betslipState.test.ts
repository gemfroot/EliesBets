import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BetslipDisableReason } from "@azuro-org/sdk";
import {
  BETSLIP_META_STORAGE_KEY,
  computeOddsDrift,
  initialMetaById,
  isPersistedBetslipSelection,
  messageForBetslipDisableReason,
  metaByIdReducer,
  pruneMetaById,
  readPersistedBetslipMeta,
  selectionId,
  stakePresetsFor,
  TOKEN_PRESETS_BY_SYMBOL,
  TOKEN_PRESETS_FALLBACK,
  USD_STAKE_PRESETS,
  usdToTokenString,
  writePersistedBetslipMeta,
  type BetslipSelection,
  type MetaById,
  type MetaByIdAction,
} from "@/components/betslipState";

function row(over: Partial<BetslipSelection> = {}): BetslipSelection {
  return {
    id: "g1::o1",
    gameId: "g1",
    gameTitle: "Team A vs Team B",
    outcomeName: "Team A",
    odds: "2.00",
    conditionId: "c1",
    outcomeId: "o1",
    ...over,
  };
}

describe("selectionId", () => {
  it("uses outcomeId when present (stable across renames)", () => {
    expect(selectionId("g", "Home", "out-7")).toBe("g::out-7");
  });
  it("falls back to outcomeName when outcomeId is missing", () => {
    expect(selectionId("g", "Home")).toBe("g::Home");
  });
  it("treats empty-string outcomeId as missing", () => {
    expect(selectionId("g", "Home", "")).toBe("g::Home");
  });
});

describe("stakePresetsFor", () => {
  it("returns the token-specific presets", () => {
    expect(stakePresetsFor("ETH")).toBe(TOKEN_PRESETS_BY_SYMBOL.ETH);
    expect(stakePresetsFor("USDC")).toEqual(["5", "10", "25", "50"]);
  });
  it("falls back when the symbol is unknown", () => {
    expect(stakePresetsFor("ZZZUNKNOWN")).toBe(TOKEN_PRESETS_FALLBACK);
  });
  it("USD presets are exposed for the toggle UI", () => {
    expect(USD_STAKE_PRESETS).toEqual(["5", "10", "25", "50"]);
  });
});

describe("usdToTokenString", () => {
  it("converts USD into the token's decimals", () => {
    // $100 at $2/ETH = 50 ETH
    expect(usdToTokenString("100", 2, 18)).toBe("50");
  });
  it("strips a leading $", () => {
    expect(usdToTokenString("$10", 1, 6)).toBe("10");
  });
  it("trims surrounding whitespace", () => {
    expect(usdToTokenString("  10  ", 1, 6)).toBe("10");
  });
  it("returns empty for empty input", () => {
    expect(usdToTokenString("", 1, 6)).toBe("");
    expect(usdToTokenString("$", 1, 6)).toBe("");
  });
  it("returns empty for non-numeric / negative / zero usdPerUnit", () => {
    expect(usdToTokenString("abc", 1, 6)).toBe("");
    expect(usdToTokenString("-1", 1, 6)).toBe("");
    expect(usdToTokenString("10", 0, 6)).toBe("");
    expect(usdToTokenString("10", -2, 6)).toBe("");
  });
  it("caps decimals at 8 to avoid parseUnits overflow", () => {
    // 1 USD at $3/unit on an 18-decimal token: 0.33333333... → cap 8 dp
    const v = usdToTokenString("1", 3, 18);
    const dp = v.split(".")[1]?.length ?? 0;
    expect(dp).toBeLessThanOrEqual(8);
  });
  it("strips trailing zeros from the result", () => {
    // 10 USD at $2/unit, 6dp = 5.000000 → 5
    expect(usdToTokenString("10", 2, 6)).toBe("5");
  });
  it("respects a 2-decimal minimum", () => {
    // Even tokens with decimals < 2 should round to >= 2 dp.
    const v = usdToTokenString("1.5", 1, 0);
    expect(v).toBe("1.5");
  });
});

// ─── reducer ───────────────────────────────────────────────────────────────

describe("metaByIdReducer", () => {
  it("starts empty by default", () => {
    expect(initialMetaById).toEqual({});
  });

  describe("hydrate", () => {
    it("no-ops when the persisted snapshot is empty", () => {
      const state: MetaById = { "g1::o1": row() };
      const next = metaByIdReducer(state, { kind: "hydrate", stored: {} });
      expect(next).toBe(state);
    });

    it("lays down the snapshot when state is empty", () => {
      const stored: MetaById = { "g1::o1": row() };
      const next = metaByIdReducer({}, { kind: "hydrate", stored });
      expect(next).toBe(stored);
    });

    it("merges with local edits taking precedence", () => {
      const local: MetaById = { "g1::o1": row({ odds: "2.50" }) };
      const stored: MetaById = {
        "g1::o1": row({ odds: "1.99" }),
        "g2::o2": row({ id: "g2::o2", gameId: "g2", outcomeId: "o2" }),
      };
      const next = metaByIdReducer(local, { kind: "hydrate", stored });
      expect(next["g1::o1"]?.odds).toBe("2.50");
      expect(next["g2::o2"]).toBeDefined();
    });
  });

  describe("add", () => {
    it("inserts a new row", () => {
      const next = metaByIdReducer({}, { kind: "add", row: row() });
      expect(next).toEqual({ "g1::o1": row() });
    });
    it("overwrites an existing row with the same id", () => {
      const before: MetaById = { "g1::o1": row({ odds: "1.50" }) };
      const next = metaByIdReducer(before, {
        kind: "add",
        row: row({ odds: "3.00" }),
      });
      expect(next["g1::o1"]?.odds).toBe("3.00");
    });
  });

  describe("remove", () => {
    it("returns the same reference when id is not present", () => {
      const before: MetaById = { "g1::o1": row() };
      const next = metaByIdReducer(before, {
        kind: "remove",
        id: "missing::id",
      });
      expect(next).toBe(before);
    });
    it("drops the row by id", () => {
      const before: MetaById = {
        "g1::o1": row(),
        "g2::o2": row({ id: "g2::o2" }),
      };
      const next = metaByIdReducer(before, { kind: "remove", id: "g1::o1" });
      expect(next).not.toHaveProperty("g1::o1");
      expect(next["g2::o2"]).toBeDefined();
    });
  });

  describe("clear", () => {
    it("returns the same reference when already empty", () => {
      const before: MetaById = {};
      const next = metaByIdReducer(before, { kind: "clear" });
      expect(next).toBe(before);
    });
    it("empties a non-empty state", () => {
      const next = metaByIdReducer({ "g1::o1": row() }, { kind: "clear" });
      expect(next).toEqual({});
    });
  });

  describe("acceptOdds", () => {
    it("no-ops on empty updates", () => {
      const before: MetaById = { "g1::o1": row() };
      const next = metaByIdReducer(before, {
        kind: "acceptOdds",
        updates: {},
      });
      expect(next).toBe(before);
    });
    it("applies new odds to existing rows", () => {
      const before: MetaById = { "g1::o1": row({ odds: "1.80" }) };
      const next = metaByIdReducer(before, {
        kind: "acceptOdds",
        updates: { "g1::o1": "2.10" },
      });
      expect(next["g1::o1"]?.odds).toBe("2.10");
      // Different reference (immutable update).
      expect(next).not.toBe(before);
    });
    it("ignores ids not currently in state", () => {
      const before: MetaById = { "g1::o1": row() };
      const next = metaByIdReducer(before, {
        kind: "acceptOdds",
        updates: { "missing::id": "5.00" },
      });
      expect(next).toBe(before);
    });
    it("returns the same reference when odds are unchanged", () => {
      const before: MetaById = { "g1::o1": row({ odds: "2.00" }) };
      const next = metaByIdReducer(before, {
        kind: "acceptOdds",
        updates: { "g1::o1": "2.00" },
      });
      expect(next).toBe(before);
    });
    it("ignores non-string odds entries (defensive)", () => {
      const before: MetaById = { "g1::o1": row() };
      const updates = { "g1::o1": null as unknown as string };
      const next = metaByIdReducer(before, {
        kind: "acceptOdds",
        updates,
      });
      expect(next).toBe(before);
    });
  });

  it("throws on an unknown action (assertNever guard)", () => {
    // Shape an action the type system doesn't know about — the runtime guard
    // protects the codebase if someone bypasses TS via cast.
    const action = { kind: "weirdo" } as unknown as MetaByIdAction;
    expect(() => metaByIdReducer({}, action)).toThrow(/unhandled action/);
  });
});

// ─── prune ────────────────────────────────────────────────────────────────

describe("pruneMetaById", () => {
  it("returns the same reference when state is empty", () => {
    const state: MetaById = {};
    expect(pruneMetaById(state, new Set())).toBe(state);
  });
  it("returns the same reference when every id is valid", () => {
    const state: MetaById = { a: row({ id: "a" }), b: row({ id: "b" }) };
    const valid = new Set(["a", "b"]);
    expect(pruneMetaById(state, valid)).toBe(state);
  });
  it("filters down to ids in the valid set", () => {
    const state: MetaById = { a: row({ id: "a" }), b: row({ id: "b" }) };
    const valid = new Set(["a"]);
    const next = pruneMetaById(state, valid);
    expect(Object.keys(next)).toEqual(["a"]);
  });
  it("returns an empty object when nothing matches", () => {
    const state: MetaById = { a: row({ id: "a" }) };
    const next = pruneMetaById(state, new Set(["other"]));
    expect(next).toEqual({});
  });
});

// ─── isPersistedBetslipSelection ───────────────────────────────────────────

describe("isPersistedBetslipSelection", () => {
  it("accepts a fully-populated row", () => {
    expect(isPersistedBetslipSelection(row())).toBe(true);
  });
  it("rejects null / non-object", () => {
    expect(isPersistedBetslipSelection(null)).toBe(false);
    expect(isPersistedBetslipSelection("string")).toBe(false);
    expect(isPersistedBetslipSelection(42)).toBe(false);
  });
  it("rejects rows missing required fields", () => {
    const incomplete = { ...row() };
    delete (incomplete as Partial<BetslipSelection>).odds;
    expect(isPersistedBetslipSelection(incomplete)).toBe(false);
  });
  it("rejects rows with wrong-typed fields", () => {
    expect(
      isPersistedBetslipSelection({ ...row(), odds: 2.0 as unknown as string }),
    ).toBe(false);
  });
});

// ─── persistence ───────────────────────────────────────────────────────────

describe("readPersistedBetslipMeta / writePersistedBetslipMeta", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when localStorage has nothing", () => {
    expect(readPersistedBetslipMeta()).toEqual({});
  });

  it("round-trips a populated meta map", () => {
    const meta: MetaById = {
      "g1::o1": row(),
      "g2::o2": row({ id: "g2::o2", gameId: "g2", outcomeId: "o2" }),
    };
    writePersistedBetslipMeta(meta);
    expect(readPersistedBetslipMeta()).toEqual(meta);
  });

  it("returns empty when JSON is invalid", () => {
    window.localStorage.setItem(BETSLIP_META_STORAGE_KEY, "{not json");
    expect(readPersistedBetslipMeta()).toEqual({});
  });

  it("rejects array-shaped storage payloads", () => {
    window.localStorage.setItem(BETSLIP_META_STORAGE_KEY, JSON.stringify([]));
    expect(readPersistedBetslipMeta()).toEqual({});
  });

  it("rejects null storage payloads", () => {
    window.localStorage.setItem(BETSLIP_META_STORAGE_KEY, "null");
    expect(readPersistedBetslipMeta()).toEqual({});
  });

  it("filters out malformed rows but keeps valid ones", () => {
    const ok = row();
    window.localStorage.setItem(
      BETSLIP_META_STORAGE_KEY,
      JSON.stringify({
        good: ok,
        bad: { id: 5 }, // wrong-typed id
        alsoBad: null,
      }),
    );
    const result = readPersistedBetslipMeta();
    expect(result).toEqual({ good: ok });
  });

  it("write swallows quota / private-mode errors", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => writePersistedBetslipMeta({ x: row() })).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });

  it("read swallows getItem exceptions", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readPersistedBetslipMeta()).toEqual({});
  });

  it("returns empty / no-ops on the server (no window global)", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(readPersistedBetslipMeta()).toEqual({});
      expect(() => writePersistedBetslipMeta({ x: row() })).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ─── computeOddsDrift ──────────────────────────────────────────────────────

describe("computeOddsDrift", () => {
  it("returns no drift when there are no selections", () => {
    expect(computeOddsDrift([], {}, 0, "single", false)).toEqual({
      hasDrift: false,
      summary: "",
    });
  });

  it("flags per-leg drift on a single (>=1% delta)", () => {
    const sel = row({ odds: "2.00", conditionId: "c1", outcomeId: "o1" });
    const result = computeOddsDrift(
      [sel],
      { "c1-o1": 2.5 }, // 25% jump
      2.5,
      "single",
      false,
    );
    expect(result.hasDrift).toBe(true);
    expect(result.summary).toMatch(/Team A:/);
  });

  it("is silent when live odds match within the 1e-6 rounding band", () => {
    const sel = row({ odds: "2.000000", conditionId: "c1", outcomeId: "o1" });
    const result = computeOddsDrift(
      [sel],
      { "c1-o1": 2.0000004 }, // rounds to the same scaled int
      2.0000004,
      "single",
      false,
    );
    expect(result.hasDrift).toBe(false);
  });

  it("ignores legs with invalid live odds", () => {
    const sel = row({ odds: "2.00", conditionId: "c1", outcomeId: "o1" });
    const a = computeOddsDrift([sel], { "c1-o1": 0 }, 0, "single", false);
    const b = computeOddsDrift([sel], { "c1-o1": -1 }, 0, "single", false);
    const c = computeOddsDrift(
      [sel],
      { "c1-o1": Number.NaN },
      0,
      "single",
      false,
    );
    expect(a.hasDrift).toBe(false);
    expect(b.hasDrift).toBe(false);
    expect(c.hasDrift).toBe(false);
  });

  it("ignores legs whose stored odds can't be parsed", () => {
    const sel = row({ odds: "—", conditionId: "c1", outcomeId: "o1" });
    const result = computeOddsDrift(
      [sel],
      { "c1-o1": 2.5 },
      2.5,
      "single",
      false,
    );
    expect(result.hasDrift).toBe(false);
  });

  it("flags combo total drift only in combo mode with multiple legs", () => {
    const a = row({ id: "a", odds: "2.00", conditionId: "c1", outcomeId: "o1" });
    const b = row({
      id: "b",
      odds: "1.50",
      conditionId: "c2",
      outcomeId: "o2",
    });
    const sdkOdds = { "c1-o1": 2.0, "c2-o2": 1.5 };
    // Per-leg unchanged, but combined total drifts up to 3.6 (vs locked 3.0).
    const drifted = computeOddsDrift([a, b], sdkOdds, 3.6, "combo", true);
    expect(drifted.hasDrift).toBe(true);
    expect(drifted.summary).toMatch(/Combined price/);

    // Same data but mode=single → combined check skipped.
    const single = computeOddsDrift([a, b], sdkOdds, 3.6, "single", true);
    expect(single.hasDrift).toBe(false);

    // multiPick=false → combined check skipped even in combo mode.
    const noPick = computeOddsDrift([a, b], sdkOdds, 3.6, "combo", false);
    expect(noPick.hasDrift).toBe(false);
  });

  it("skips combined check when one leg has unparseable odds", () => {
    const a = row({ id: "a", odds: "—", conditionId: "c1", outcomeId: "o1" });
    const b = row({
      id: "b",
      odds: "1.50",
      conditionId: "c2",
      outcomeId: "o2",
    });
    const result = computeOddsDrift(
      [a, b],
      { "c2-o2": 1.5 },
      3.6,
      "combo",
      true,
    );
    expect(result.hasDrift).toBe(false);
  });
});

// ─── messageForBetslipDisableReason ────────────────────────────────────────

describe("messageForBetslipDisableReason", () => {
  it("returns null for undefined", () => {
    expect(messageForBetslipDisableReason(undefined)).toBeNull();
  });

  it.each([
    [BetslipDisableReason.ConditionState, /paused/],
    [BetslipDisableReason.BetAmountGreaterThanMaxBet, /maximum/],
    [BetslipDisableReason.BetAmountLowerThanMinBet, /minimum/],
    [BetslipDisableReason.ComboWithForbiddenItem, /cannot be combined/],
    [BetslipDisableReason.ComboWithSameGame, /same game/],
    [BetslipDisableReason.SelectedOutcomesTemporarySuspended, /temporarily/],
    [BetslipDisableReason.TotalOddsTooLow, /too low/],
    [BetslipDisableReason.FreeBetExpired, /expired/],
    [BetslipDisableReason.PrematchConditionInStartedGame, /already started/],
  ])("maps %s to a user-readable copy", (reason, pattern) => {
    expect(messageForBetslipDisableReason(reason)).toMatch(pattern);
  });

  it("falls back to a generic message for unknown enum values", () => {
    const fake = "TotallyMadeUp" as unknown as BetslipDisableReason;
    expect(messageForBetslipDisableReason(fake)).toBe(
      "This bet cannot be placed right now.",
    );
  });
});
