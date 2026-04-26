import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import {
  makeAzuroActionChain,
  makeBet,
  makeCashout,
  makeChain,
  makePrecalc,
} from "@/__tests__/harness/azuro";
import { makeConnection, makeQueryClient } from "@/__tests__/harness/wagmi";
import { renderWithProviders } from "@/__tests__/harness/render";

// ─── module mocks (factories run before any import) ────────────────────────

const azuroChainMock = vi.fn(() => makeAzuroActionChain());
const chainMock = vi.fn(() => makeChain());
const precalcMock = vi.fn(() => makePrecalc());
const cashoutMock = vi.fn(() => makeCashout());
const connectionMock = vi.fn(() => makeConnection());
const queryClientMock = vi.fn(() => makeQueryClient());

vi.mock("@/lib/useAzuroActionChain", () => ({
  useAzuroActionChain: () => azuroChainMock(),
}));

vi.mock("@azuro-org/sdk", async () => {
  const actual = await vi.importActual<typeof import("@azuro-org/sdk")>(
    "@azuro-org/sdk",
  );
  return {
    ...actual,
    useChain: () => chainMock(),
    usePrecalculatedCashouts: () => precalcMock(),
    useCashout: () => cashoutMock(),
  };
});

vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useConnection: () => connectionMock(),
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => queryClientMock(),
  };
});

// CashoutButton imports `getBalanceQueryKey` purely as a key builder; default
// behavior is fine.

import { CashoutButton } from "@/components/CashoutButton";

describe("CashoutButton", () => {
  beforeEach(() => {
    azuroChainMock.mockImplementation(() => makeAzuroActionChain());
    chainMock.mockImplementation(() => makeChain());
    precalcMock.mockImplementation(() => makePrecalc());
    cashoutMock.mockImplementation(() => makeCashout());
    connectionMock.mockImplementation(() => makeConnection());
    queryClientMock.mockImplementation(() => makeQueryClient());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when the bet is not eligible (already won/lost)", () => {
    const bet = makeBet({ isWin: true, isCanceled: false });
    // Force the eligibility gate to fail: a settled win shouldn't show cashout.
    // CashoutButton uses isPendingBet which requires !isWin && !isLose && !isCanceled.
    renderWithProviders(<CashoutButton bet={bet} />);
    expect(screen.queryByText(/Cash out value/i)).not.toBeInTheDocument();
  });

  it("renders the cashout amount when eligible and has a quote", () => {
    const bet = makeBet({
      isWin: false,
      isLose: false,
      isCanceled: false,
      isCashedOut: false,
    });
    renderWithProviders(<CashoutButton bet={bet} />);
    expect(screen.getByText(/Cash out value/i)).toBeInTheDocument();
    expect(screen.getByText("9.50")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Cash out$/i }),
    ).toBeEnabled();
  });

  it("shows the wrong-chain callout when wallet is on a different chain", () => {
    azuroChainMock.mockImplementation(() =>
      makeAzuroActionChain({
        onBetChain: false,
        appChainName: "Polygon",
        walletChainName: "Gnosis",
      }),
    );
    const bet = makeBet({ isWin: false, isLose: false });
    renderWithProviders(<CashoutButton bet={bet} />);
    expect(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    ).toBeInTheDocument();
  });

  it("toasts when the user rejects the chain switch (P0.2 regression guard)", async () => {
    const user = userEvent.setup();
    azuroChainMock.mockImplementation(() =>
      makeAzuroActionChain({
        onBetChain: false,
        appChainName: "Polygon",
        walletChainName: "Gnosis",
        switchToAppChain: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("user rejected"), { code: 4001 }),
          ),
      }),
    );
    const bet = makeBet({ isWin: false, isLose: false });
    renderWithProviders(<CashoutButton bet={bet} />);

    await user.click(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    );

    // formatWalletTxError maps `user rejected` → "You cancelled the request in
    // your wallet." — the toast must appear with that copy.
    await waitFor(() => {
      expect(
        screen.getByText(/cancelled the request in your wallet/i),
      ).toBeInTheDocument();
    });
  });

  it("opens the confirm dialog when Cash out is clicked", async () => {
    const user = userEvent.setup();
    const bet = makeBet({ isWin: false, isLose: false });
    renderWithProviders(<CashoutButton bet={bet} />);

    const triggers = screen.getAllByRole("button", { name: /^Cash out$/i });
    await user.click(triggers[0]!);

    // The confirm dialog opens a second action (confirm or cancel). Look for a
    // dialog role first; fall back to counting cashout-labelled buttons.
    const dialog = await screen.findByRole("dialog").catch(() => null);
    if (!dialog) {
      const after = screen.getAllByRole("button", { name: /Cash out/i });
      expect(after.length).toBeGreaterThan(triggers.length);
    } else {
      expect(dialog).toBeInTheDocument();
    }
  });

  it("disables the button while the calculation query is loading", () => {
    cashoutMock.mockImplementation(() =>
      makeCashout({
        isCashoutAvailable: false, // canTryCashout requires this AND precalc
        calculationQuery: {
          isLoading: true,
          isError: false,
          error: null,
          refetch: vi.fn(),
        },
      }),
    );
    precalcMock.mockImplementation(() =>
      makePrecalc({
        data: { cashoutAmount: 9.5, isAvailable: false },
        isLoading: true,
      }),
    );
    const bet = makeBet({ isWin: false, isLose: false });
    renderWithProviders(<CashoutButton bet={bet} />);
    expect(
      screen.getByRole("button", { name: /^Cash out$/i }),
    ).toBeDisabled();
  });

  it("hides the section when no quote ever arrived", () => {
    precalcMock.mockImplementation(() =>
      makePrecalc({ data: { cashoutAmount: NaN, isAvailable: false } }),
    );
    cashoutMock.mockImplementation(() =>
      makeCashout({ isCashoutAvailable: false }),
    );
    const bet = makeBet({ isWin: false, isLose: false });
    renderWithProviders(<CashoutButton bet={bet} />);
    expect(screen.queryByText(/Cash out value/i)).not.toBeInTheDocument();
  });
});
