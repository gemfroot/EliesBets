import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import {
  makeAzuroActionChain,
  makeBet,
  makeBetsSummary,
  makeChain,
  makeRedeemBet,
} from "@/__tests__/harness/azuro";
import { makeConnection, makeQueryClient } from "@/__tests__/harness/wagmi";
import { renderWithProviders } from "@/__tests__/harness/render";

const azuroChainMock = vi.fn(() => makeAzuroActionChain());
const chainMock = vi.fn(() => ({
  ...makeChain(),
  appChain: { id: 137, name: "Polygon", blockExplorers: undefined },
}));
const redeemMock = vi.fn(() => makeRedeemBet());
const betsSummaryMock = vi.fn(() => ({
  data: makeBetsSummary(),
  refetch: vi.fn(),
}));
const oddsFormatMock = vi.fn(() => ({ format: "decimal" as const }));
const connectionMock = vi.fn(() => makeConnection());
const queryClientMock = vi.fn(() => makeQueryClient());

vi.mock("@/lib/useAzuroActionChain", () => ({
  useAzuroActionChain: () => azuroChainMock(),
}));
vi.mock("@/components/OddsFormatProvider", () => ({
  useOddsFormat: () => oddsFormatMock(),
  OddsFormatProvider: ({ children }: { children: React.ReactNode }) => children,
}));
// CashoutButton has its own dependency tree we don't want to set up here.
// BetCard always renders it; replace with a stub.
vi.mock("@/components/CashoutButton", () => ({
  CashoutButton: () => null,
}));

vi.mock("@azuro-org/sdk", async () => {
  const actual = await vi.importActual<typeof import("@azuro-org/sdk")>(
    "@azuro-org/sdk",
  );
  return {
    ...actual,
    useChain: () => chainMock(),
    useRedeemBet: () => redeemMock(),
    useBetsSummary: () => betsSummaryMock(),
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

import { BetCard } from "@/components/BetCard";

const wonBet = (over = {}) =>
  makeBet({
    tokenId: "bet-1",
    orderId: "order-42",
    amount: "10",
    odds: 2,
    totalOdds: 2,
    possibleWin: 20,
    payout: 20,
    isWin: true,
    isRedeemable: true,
    isRedeemed: false,
    outcomes: [
      {
        conditionId: "c1",
        outcomeId: "o1",
        odds: 2,
        selectionName: "Team A",
        marketName: "Match Result",
      },
    ],
    txHash: "0xtx",
    ...over,
  } as never);

describe("BetCard", () => {
  beforeEach(() => {
    azuroChainMock.mockImplementation(() => makeAzuroActionChain());
    chainMock.mockImplementation(() => ({
      ...makeChain(),
      appChain: { id: 137, name: "Polygon", blockExplorers: undefined },
    }));
    redeemMock.mockImplementation(() => makeRedeemBet());
    betsSummaryMock.mockImplementation(() => ({
      data: makeBetsSummary(),
      refetch: vi.fn(),
    }));
    oddsFormatMock.mockImplementation(() => ({ format: "decimal" as const }));
    connectionMock.mockImplementation(() => makeConnection());
    queryClientMock.mockImplementation(() => makeQueryClient());
  });
  afterEach(() => vi.clearAllMocks());

  it("renders core bet info (status, order id, stake)", () => {
    renderWithProviders(<BetCard bet={wonBet()} />);
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("order-42")).toBeInTheDocument();
    expect(screen.getByText("Single")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument(); // stake
  });

  it("labels combos with their selection count", () => {
    const combo = wonBet({
      outcomes: [
        {
          conditionId: "c1",
          outcomeId: "o1",
          odds: 2,
          selectionName: "Team A",
          marketName: "Match Result",
        },
        {
          conditionId: "c2",
          outcomeId: "o2",
          odds: 1.5,
          selectionName: "Over 2.5",
          marketName: "Total Goals",
        },
      ],
    });
    renderWithProviders(<BetCard bet={combo} />);
    expect(screen.getByText(/Combo · 2 selections/i)).toBeInTheDocument();
  });

  it("does not show the Claim button when the bet is not claimable", () => {
    renderWithProviders(
      <BetCard
        bet={wonBet({ isRedeemable: false, isLose: true, isWin: false })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Claim$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the wrong-chain callout when wallet is on the wrong chain", () => {
    azuroChainMock.mockImplementation(() =>
      makeAzuroActionChain({
        onBetChain: false,
        appChainName: "Polygon",
        walletChainName: "Base",
      }),
    );
    renderWithProviders(<BetCard bet={wonBet()} />);
    expect(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    ).toBeInTheDocument();
    // Claim button should be disabled while off-chain.
    expect(screen.getByRole("button", { name: /^Claim$/i })).toBeDisabled();
  });

  it("toasts when the user rejects the chain switch (P0.2 regression guard)", async () => {
    const user = userEvent.setup();
    azuroChainMock.mockImplementation(() =>
      makeAzuroActionChain({
        onBetChain: false,
        appChainName: "Polygon",
        walletChainName: "Base",
        switchToAppChain: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("user rejected"), { code: 4001 }),
          ),
      }),
    );
    renderWithProviders(<BetCard bet={wonBet()} />);

    await user.click(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/cancelled the request in your wallet/i),
      ).toBeInTheDocument();
    });
  });

  it("calls submit and shows the success toast on a successful claim", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    redeemMock.mockImplementation(() => makeRedeemBet({ submit }));

    renderWithProviders(<BetCard bet={wonBet()} />);
    await user.click(screen.getByRole("button", { name: /^Claim$/i }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Winnings claimed\./i)).toBeInTheDocument();
    });
  });

  it("surfaces a claim error inline when submit throws", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {
      throw new Error("execution reverted: LP: not enough liquidity");
    });
    redeemMock.mockImplementation(() => makeRedeemBet({ submit }));

    renderWithProviders(<BetCard bet={wonBet()} />);
    await user.click(screen.getByRole("button", { name: /^Claim$/i }));

    await waitFor(() => {
      // formatWalletTxError prefixes the contract-revert copy.
      expect(
        screen.getByRole("alert"),
      ).toHaveTextContent(/contract reverted|not enough liquidity/i);
    });
  });

  it("disables Claim while a redeem is in flight", () => {
    redeemMock.mockImplementation(() =>
      makeRedeemBet({ isPending: true }),
    );
    renderWithProviders(<BetCard bet={wonBet()} />);
    const btn = screen.getByRole("button", { name: /Claiming…|^Claim$/i });
    expect(btn).toBeDisabled();
  });
});
