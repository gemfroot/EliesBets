import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import {
  makeAzuroActionChain,
  makeBet,
  makeBetsSummary,
  makeRedeemBet,
} from "@/__tests__/harness/azuro";
import { makeConnection, makeQueryClient } from "@/__tests__/harness/wagmi";
import { renderWithProviders } from "@/__tests__/harness/render";

const azuroChainMock = vi.fn(() =>
  Object.assign(makeAzuroActionChain(), { appChainId: 137 }),
);
const redeemMock = vi.fn(() => makeRedeemBet());
const betsSummaryMock = vi.fn(() => ({
  data: makeBetsSummary(),
  refetch: vi.fn(),
}));
const settledPrefetchMock = vi.fn(() => ({ refetch: vi.fn() }));
const connectionMock = vi.fn(() => makeConnection());
const queryClientMock = vi.fn(() => makeQueryClient());

vi.mock("@/lib/useAzuroActionChain", () => ({
  useAzuroActionChain: () => azuroChainMock(),
}));

vi.mock("@/components/SettledBetsPrefetchProvider", () => ({
  useSettledBetsPrefetch: () => settledPrefetchMock(),
  // ClaimAllBetsButton only imports the hook, but other consumers may import
  // the provider — keep a noop export so module load doesn't blow up.
  SettledBetsPrefetchProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@azuro-org/sdk", async () => {
  const actual = await vi.importActual<typeof import("@azuro-org/sdk")>(
    "@azuro-org/sdk",
  );
  return {
    ...actual,
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

import { ClaimAllBetsButton } from "@/components/ClaimAllBetsButton";

describe("ClaimAllBetsButton", () => {
  beforeEach(() => {
    azuroChainMock.mockImplementation(() =>
      Object.assign(makeAzuroActionChain(), { appChainId: 137 }),
    );
    redeemMock.mockImplementation(() => makeRedeemBet());
    betsSummaryMock.mockImplementation(() => ({
      data: makeBetsSummary(),
      refetch: vi.fn(),
    }));
    settledPrefetchMock.mockImplementation(() => ({ refetch: vi.fn() }));
    connectionMock.mockImplementation(() => makeConnection());
    queryClientMock.mockImplementation(() => makeQueryClient());
  });
  afterEach(() => vi.clearAllMocks());

  it("renders the win count when there are claimable bets", () => {
    const wins = [
      makeBet({ tokenId: "1", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
      makeBet({ tokenId: "2", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
    ];
    renderWithProviders(<ClaimAllBetsButton bets={wins} />);
    expect(
      screen.getByRole("button", { name: /Claim all \(2\)/i }),
    ).toBeInTheDocument();
  });

  it("shows the wrong-chain callout when wallet is not on the bet chain", () => {
    azuroChainMock.mockImplementation(() =>
      Object.assign(
        makeAzuroActionChain({
          onBetChain: false,
          appChainName: "Polygon",
          walletChainName: "Base",
        }),
        { appChainId: 137 },
      ),
    );
    const wins = [
      makeBet({ tokenId: "1", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
    ];
    renderWithProviders(<ClaimAllBetsButton bets={wins} />);
    expect(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    ).toBeInTheDocument();
  });

  it("toasts when the user rejects the chain switch (P0.2 regression guard)", async () => {
    const user = userEvent.setup();
    azuroChainMock.mockImplementation(() =>
      Object.assign(
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
        { appChainId: 137 },
      ),
    );
    const wins = [
      makeBet({ tokenId: "1", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
    ];
    renderWithProviders(<ClaimAllBetsButton bets={wins} />);

    await user.click(
      screen.getByRole("button", { name: /Switch wallet to Polygon/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/cancelled the request in your wallet/i),
      ).toBeInTheDocument();
    });
  });

  it("calls useRedeemBet.submit on Claim click (happy path)", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    redeemMock.mockImplementation(() => makeRedeemBet({ submit }));

    const wins = [
      makeBet({ tokenId: "1", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
      makeBet({ tokenId: "2", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
    ];
    renderWithProviders(<ClaimAllBetsButton bets={wins} />);

    await user.click(screen.getByRole("button", { name: /Claim all \(2\)/i }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    // First call — both bets in one batch (under CLAIM_BATCH_SIZE=6).
    const calls = submit.mock.calls as unknown as Array<[{ bets: unknown[] }]>;
    expect(calls[0]?.[0]?.bets).toHaveLength(2);
  });

  it("emits an info toast when no bets are claimable and there's nothing to fetch", async () => {
    const user = userEvent.setup();
    const lost = makeBet({
      tokenId: "1",
      lpAddress: "0xLP",
      coreAddress: "0xCORE",
      isWin: false,
      isLose: true,
      isRedeemable: false,
    } as never);
    // We need at least the button to render. Force summary to claim something
    // so the early-return doesn't happen, then send an empty redeemable list
    // through.
    betsSummaryMock.mockImplementation(() => ({
      data: makeBetsSummary({ toPayout: 5 }),
      refetch: vi.fn(),
    }));
    renderWithProviders(
      <ClaimAllBetsButton bets={[lost]} fetchNextPage={undefined} />,
    );

    // The button should NOT show a count (claimable=0); the label falls back
    // to the summary-based copy.
    const btn = screen.getByRole("button", { name: /Claim/i });
    await user.click(btn);

    await waitFor(() => {
      // Either the "No claimable bets" toast (no fetchNextPage) or the
      // summary-mismatch info toast — both are valid signals that the click
      // was handled and a toast surfaced.
      const claimable = screen.queryByText(/No claimable bets found/i);
      const mismatch = screen.queryByText(
        /Summary still shows funds to claim/i,
      );
      expect(claimable ?? mismatch).toBeTruthy();
    });
  });

  it("disables the button while the redeem is processing", () => {
    redeemMock.mockImplementation(() =>
      makeRedeemBet({ isPending: true }),
    );
    const wins = [
      makeBet({ tokenId: "1", lpAddress: "0xLP", coreAddress: "0xCORE" } as never),
    ];
    renderWithProviders(<ClaimAllBetsButton bets={wins} />);
    // While pending, the label shows "Claiming…" or similar; check disabled.
    const btn = screen.getByRole("button", { name: /Claim/i });
    expect(btn).toBeDisabled();
  });
});
