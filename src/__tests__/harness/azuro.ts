import { vi } from "vitest";
import type { Bet } from "@azuro-org/sdk";
import { GraphBetStatus } from "@azuro-org/toolkit";

/** Default Azuro chain context — Polygon, wallet on the correct chain. */
export function makeAzuroActionChain(over: Partial<{
  onBetChain: boolean;
  appChainName: string;
  walletChainName: string;
  switchPending: boolean;
  switchToAppChain: () => Promise<void>;
}> = {}) {
  return {
    onBetChain: true,
    appChainName: "Polygon",
    walletChainName: "Polygon",
    switchPending: false,
    switchToAppChain: vi.fn(async () => {}),
    ...over,
  };
}

/** Default useChain return — Polygon mainnet, USDT bet token. */
export function makeChain() {
  return {
    appChain: { id: 137, name: "Polygon" },
    betToken: { symbol: "USDT", decimals: 6, address: "0xUSDT" as const },
    chain: { id: 137 },
    isRightNetwork: true,
  };
}

/** A baseline winning bet ready for redemption. */
export function makeBet(over: Partial<Bet> = {}): Bet {
  return {
    tokenId: "bet-1",
    amount: 10,
    odds: 2,
    possibleWin: 20,
    payout: null,
    isRedeemable: true,
    isRedeemed: false,
    isWin: true,
    isLose: false,
    isCanceled: false,
    isRejected: false,
    isCashedOut: false,
    resolvedAt: 1_700_000_000,
    freebetId: null,
    status: GraphBetStatus.Accepted,
    totalOdds: 2,
    outcomes: [
      {
        conditionId: "c1",
        outcomeId: "o1",
      },
    ],
    ...over,
  } as unknown as Bet;
}

/** Minimal `usePrecalculatedCashouts` return that lets the cashout UI render. */
export function makePrecalc(over: Partial<{
  data: { cashoutAmount: number; isAvailable: boolean } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => unknown;
}> = {}) {
  return {
    data: { cashoutAmount: 9.5, isAvailable: true },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
    ...over,
  };
}

/** Minimal `useCashout` return — non-busy, available. */
export function makeCashout(over: Partial<{
  submit: () => Promise<void>;
  isCashoutAvailable: boolean;
  isApproveRequired: boolean;
  calculationQuery: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  cashoutTx: { isPending: boolean; isProcessing: boolean };
  approveTx: { isPending: boolean; isProcessing: boolean; receipt: unknown };
}> = {}) {
  return {
    submit: vi.fn(async () => {}),
    isCashoutAvailable: true,
    isApproveRequired: false,
    calculationQuery: {
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    cashoutTx: { isPending: false, isProcessing: false },
    approveTx: { isPending: false, isProcessing: false, receipt: null },
    ...over,
  };
}

/** Minimal `useRedeemBet` return — happy path. */
export function makeRedeemBet(over: Partial<{
  submit: (args: unknown) => Promise<void>;
  isPending: boolean;
  isProcessing: boolean;
  isSuccess: boolean;
}> = {}) {
  return {
    submit: vi.fn(async () => {}),
    isPending: false,
    isProcessing: false,
    isSuccess: false,
    ...over,
  };
}

/** Minimal `useBetsSummary` return. */
export function makeBetsSummary(over: Partial<{
  toPayout: number;
  toBet: number;
  isLoading: boolean;
}> = {}) {
  return {
    toPayout: 0,
    toBet: 0,
    isLoading: false,
    ...over,
  };
}
