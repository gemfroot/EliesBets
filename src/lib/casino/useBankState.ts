"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { bankAbi } from "@/lib/casino/abis/Bank";
import {
  getCasinoBankAddress,
  type BetToken,
} from "@/lib/casino/addresses";

/**
 * Pre-flight read of the Bank's per-token bet cap. Purpose: stop users from
 * submitting a wager that will always revert — the Bank enforces a
 * balanceRisk cap so `maxBet` is effectively `bankBalance * risk% / (payout - 1)`.
 * Under-funded banks drop maxBet to a handful of wei and every wager reverts
 * with a cryptic "ExcessiveBetAmount" / division-by-zero.
 *
 * We compute at a conservative 2x multiplier (19800 basis points). Games with
 * higher multipliers (dice at 99x, wheel, plinko) will bind even tighter — the
 * check here is "can *anything* be bet at all?", not the per-game ceiling.
 *
 * `multiplier` is in basis points: 19800 = 1.98x, 99_000_000 = 99x.
 */
export function useCasinoBankState(
  chainId: number,
  betToken: BetToken,
  multiplierBps: bigint = 19_800n,
): {
  isOperational: boolean;
  statusLabel: string | null;
  maxBet: bigint | undefined;
  minBet: bigint | undefined;
} {
  const bank = useMemo(() => getCasinoBankAddress(chainId), [chainId]);
  const bankConfigured = bank !== zeroAddress;

  const { data } = useReadContract({
    address: bank,
    abi: bankAbi,
    functionName: "getBetRequirements",
    args: [betToken.address as Address, multiplierBps],
    query: { enabled: bankConfigured },
  });

  const [allowed, minBet, maxBet] = (data as
    | readonly [boolean, bigint, bigint]
    | undefined) ?? [undefined, undefined, undefined];

  if (!bankConfigured) {
    return {
      isOperational: false,
      statusLabel: "Casino not configured on this network.",
      maxBet: undefined,
      minBet: undefined,
    };
  }
  if (allowed === undefined || minBet === undefined || maxBet === undefined) {
    // Still loading
    return {
      isOperational: false,
      statusLabel: null,
      maxBet: undefined,
      minBet: undefined,
    };
  }

  if (!allowed) {
    return {
      isOperational: false,
      statusLabel: `${betToken.symbol} bets are currently paused by the bank operator.`,
      maxBet,
      minBet,
    };
  }

  // "Effectively unfunded": a real maxBet should be meaningfully above minBet
  // and above the VRF cost. If max < min, or max is a few wei, the bank just
  // can't cover a payout. Use min as the threshold — if max < min the bank
  // literally cannot accept a valid bet.
  if (maxBet < minBet || maxBet === 0n) {
    return {
      isOperational: false,
      statusLabel: `${betToken.symbol} bank is below the risk floor — no bets can be accepted until liquidity is topped up.`,
      maxBet,
      minBet,
    };
  }

  return {
    isOperational: true,
    statusLabel: null,
    maxBet,
    minBet,
  };
}
