import { createContext, useContext } from "react";
import type { Address } from "viem";

export type PendingGameType = "coinToss" | "dice" | "roulette" | "keno" | "wheel" | "plinko";

export type PendingBetStatus = "pending" | "stalled" | "resolved" | "refunded";

export type PendingBet = {
  /** Stable client-generated id (uuid) — survives reloads via localStorage. */
  id: string;
  game: PendingGameType;
  chainId: number;
  contract: Address;
  /** Wager tx hash, for explorer link. */
  txHash: `0x${string}`;
  /** Block number the wager was mined in; undefined until receipt known. */
  blockNumber?: string; // bigint serialized
  /** Stake amount + token for display (wei as string). */
  stakeWei: string;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Unix ms when the bet was placed. */
  placedAt: number;
  /** Last roll id we had on hand at placement — so the resolver can diff. */
  baselineRollId?: string;
  status: PendingBetStatus;
  /** When resolved, the outcome summary text. */
  outcome?: string;
  /** When resolved, net P&L wei (signed) as string. */
  netWei?: string;
};

export type PendingBetsContext = {
  pending: PendingBet[];
  addPending: (bet: Omit<PendingBet, "status" | "placedAt" | "id"> & { id?: string; placedAt?: number }) => string;
  markBlock: (id: string, blockNumber: bigint) => void;
  markStalled: (id: string) => void;
  resolve: (id: string, outcome: string, netWei: bigint) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const noop = () => {
  throw new Error("PendingBetsProvider not mounted");
};

export const PendingBetsCtx = createContext<PendingBetsContext>({
  pending: [],
  addPending: noop as never,
  markBlock: noop,
  markStalled: noop,
  resolve: noop,
  dismiss: noop,
  clear: noop,
});

export function usePendingBets(): PendingBetsContext {
  return useContext(PendingBetsCtx);
}
