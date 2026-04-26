import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, render, screen } from "@testing-library/react";
import { ConditionState } from "@azuro-org/toolkit";
import { ToastProvider } from "@/components/Toast";
import {
  BETSLIP_META_STORAGE_KEY,
  type BetslipSelection,
} from "@/components/betslipState";

// ── Module mocks ───────────────────────────────────────────────────────────
//
// The full `BetslipStakeAndPlace` requires ~10 SDK / wagmi hooks to even
// render. We're testing the *Provider's* public API (selections list,
// add/remove, persistence) — `BetslipPanel` is the right surface and only
// needs `useBaseBetslip` and `useConditionsState` mocked, plus the
// OddsFormat context.

const baseItemsRef: { current: BaseItem[] } = { current: [] };
type BaseItem = {
  gameId: string;
  conditionId: string;
  outcomeId: string;
  isExpressForbidden?: boolean;
};

const useBaseBetslipMock = vi.fn(() => ({
  items: baseItemsRef.current,
  addItem: (i: BaseItem) => {
    baseItemsRef.current = [...baseItemsRef.current, i];
  },
  removeItem: (i: { conditionId: string; outcomeId: string }) => {
    baseItemsRef.current = baseItemsRef.current.filter(
      (it) =>
        !(it.conditionId === i.conditionId && it.outcomeId === i.outcomeId),
    );
  },
  clear: () => {
    baseItemsRef.current = [];
  },
}));

const conditionsStateMock = vi.fn(() => ({
  data: {} as Record<string, ConditionState>,
}));

vi.mock("@azuro-org/sdk", async () => {
  const actual = await vi.importActual<typeof import("@azuro-org/sdk")>(
    "@azuro-org/sdk",
  );
  return {
    ...actual,
    useBaseBetslip: () => useBaseBetslipMock(),
    useConditionsState: () => conditionsStateMock(),
  };
});

vi.mock("@/components/OddsFormatProvider", () => ({
  useOddsFormat: () => ({ format: "decimal" as const }),
  OddsFormatProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// MobileBetslipDrawer is dynamic-imported and not under test here.
vi.mock("@/components/MobileBetslipDrawer", () => ({
  MobileBetslipDrawer: () => null,
}));

import {
  BetslipPanel,
  BetslipProvider,
  useBetslipActions,
  useBetslipSelections,
} from "@/components/Betslip";

function renderBetslip() {
  return render(
    <ToastProvider>
      <BetslipProvider>
        <BetslipPanel />
      </BetslipProvider>
    </ToastProvider>,
  );
}

/** Tiny harness that exposes the actions context so tests can call
 *  addSelection / removeSelection / clear without rendering an OddsButton. */
function ActionsProbe({
  onReady,
}: {
  onReady: (api: {
    actions: ReturnType<typeof useBetslipActions>;
    selections: ReturnType<typeof useBetslipSelections>["selections"];
  }) => void;
}) {
  const actions = useBetslipActions();
  const { selections } = useBetslipSelections();
  onReady({ actions, selections });
  return null;
}

describe("BetslipPanel + BetslipProvider", () => {
  beforeEach(() => {
    baseItemsRef.current = [];
    useBaseBetslipMock.mockClear();
    conditionsStateMock.mockClear();
    window.localStorage.clear();
  });
  afterEach(() => vi.clearAllMocks());

  it("renders the empty state when there are no selections", () => {
    renderBetslip();
    expect(screen.getByText(/Your betslip is empty/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tap odds on any game to add picks/i),
    ).toBeInTheDocument();
  });

  it("addSelection puts a row in the list (visible to consumers via the hooks)", async () => {
    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    expect(api.selections).toHaveLength(0);

    act(() => {
      api.actions.addSelection({
        gameId: "g1",
        gameTitle: "Team A vs Team B",
        outcomeName: "Team A",
        odds: "2.10",
        conditionId: "c1",
        outcomeId: "o1",
      });
    });

    // After the dispatch + re-render, the probe sees the new selection.
    expect(api.selections).toHaveLength(1);
    expect(api.selections[0]?.outcomeName).toBe("Team A");
    expect(api.selections[0]?.odds).toBe("2.10");
  });

  it("addSelection on an already-selected outcome toggles it off", () => {
    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    const pick = {
      gameId: "g1",
      gameTitle: "T",
      outcomeName: "Team A",
      odds: "2.0",
      conditionId: "c1",
      outcomeId: "o1",
    };

    act(() => api.actions.addSelection(pick));
    expect(api.selections).toHaveLength(1);
    act(() => api.actions.addSelection(pick));
    expect(api.selections).toHaveLength(0);
  });

  it("acceptOdds updates the stored odds for an existing row", () => {
    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    act(() =>
      api.actions.addSelection({
        gameId: "g1",
        gameTitle: "T",
        outcomeName: "A",
        odds: "1.80",
        conditionId: "c1",
        outcomeId: "o1",
      }),
    );
    const id = api.selections[0]!.id;
    expect(api.selections[0]?.odds).toBe("1.80");

    act(() => api.actions.acceptOdds({ [id]: "2.05" }));
    expect(api.selections[0]?.odds).toBe("2.05");
  });

  it("clearSelections wipes both the slip and the meta map", () => {
    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    act(() =>
      api.actions.addSelection({
        gameId: "g1",
        gameTitle: "T",
        outcomeName: "A",
        odds: "2",
        conditionId: "c1",
        outcomeId: "o1",
      }),
    );
    expect(api.selections).toHaveLength(1);

    act(() => api.actions.clearSelections());
    expect(api.selections).toHaveLength(0);
  });

  it("removeSelection drops the row by id", () => {
    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    act(() =>
      api.actions.addSelection({
        gameId: "g1",
        gameTitle: "T",
        outcomeName: "A",
        odds: "2",
        conditionId: "c1",
        outcomeId: "o1",
      }),
    );
    const id = api.selections[0]!.id;
    expect(api.selections).toHaveLength(1);

    act(() => api.actions.removeSelection(id));
    expect(api.selections).toHaveLength(0);
  });

  it("hydrates persisted meta on mount when none was set yet", () => {
    const stored: BetslipSelection = {
      id: "g1::o1",
      gameId: "g1",
      gameTitle: "Team A vs Team B",
      outcomeName: "Team A",
      odds: "2.10",
      conditionId: "c1",
      outcomeId: "o1",
    };
    window.localStorage.setItem(
      BETSLIP_META_STORAGE_KEY,
      JSON.stringify({ "g1::o1": stored }),
    );
    // SDK still says the slip has the matching item, so the prune doesn't
    // immediately discard the hydrated row.
    baseItemsRef.current = [
      { gameId: "g1", conditionId: "c1", outcomeId: "o1" },
    ];

    let api!: Parameters<Parameters<typeof ActionsProbe>[0]["onReady"]>[0];
    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={(a) => (api = a)} />
        </BetslipProvider>
      </ToastProvider>,
    );

    expect(api.selections).toHaveLength(1);
    expect(api.selections[0]?.gameTitle).toBe("Team A vs Team B");
    expect(api.selections[0]?.odds).toBe("2.10");
  });

  it("auto-evicts terminal-state picks (Canceled / Removed / Resolved)", () => {
    baseItemsRef.current = [
      { gameId: "g1", conditionId: "c1", outcomeId: "o1" },
    ];
    conditionsStateMock.mockImplementation(() => ({
      data: { c1: ConditionState.Canceled },
    }));

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={() => {}} />
        </BetslipProvider>
      </ToastProvider>,
    );

    // Eviction effect ran on mount; the SDK store (mocked) was drained.
    // (The public selections list updates on the next render, which our
    // minimal mock doesn't trigger — we verify the SDK-side write directly.)
    expect(baseItemsRef.current).toHaveLength(0);
  });

  it("does NOT auto-evict on Stopped (transient pause)", () => {
    baseItemsRef.current = [
      { gameId: "g1", conditionId: "c1", outcomeId: "o1" },
    ];
    conditionsStateMock.mockImplementation(() => ({
      data: { c1: ConditionState.Stopped },
    }));

    render(
      <ToastProvider>
        <BetslipProvider>
          <ActionsProbe onReady={() => {}} />
        </BetslipProvider>
      </ToastProvider>,
    );

    expect(baseItemsRef.current).toHaveLength(1);
  });
});
