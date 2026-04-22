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
 * Pre-flight check against the Bank's `getBetRequirements(token, multiplier)`.
 *
 * Returns `(isAllowedToken, maxBetAmount, maxBetCount)`. We use the first two
 * fields here:
 *  - `isAllowedToken=false`  → the token is paused or not registered.
 *  - `maxBetAmount === 0n`   → no liquidity to cover any payout at this
 *                              multiplier; every wager() reverts.
 *  - any other value         → operational. `maxBetAmount` is exposed so the
 *                              game UI can display / cap the user's stake.
 *
 * (Earlier versions of this hook mistakenly treated the third return value
 * as `minBet` and gated "under-funded" on `maxBet < minBet`. The third value
 * is `maxBetCount` — how many rolls you can batch into one tx — and that
 * comparison was meaningless.)
 *
 * `multiplier` is in basis points: 19800 = 1.98×, 20000 = 2×. Games with
 * higher multipliers should pass their own value.
 */
export function useCasinoBankState(
  chainId: number,
  betToken: BetToken,
  multiplierBps: bigint = 19_800n,
): {
  isOperational: boolean;
  statusLabel: string | null;
  maxBetAmount: bigint | undefined;
  maxBetCount: bigint | undefined;
} {
  const bank = useMemo(() => getCasinoBankAddress(chainId), [chainId]);
  const bankConfigured = bank !== zeroAddress;

  const { data, isLoading, isError } = useReadContract({
    address: bank,
    abi: bankAbi,
    functionName: "getBetRequirements",
    args: [betToken.address as Address, multiplierBps],
    query: { enabled: bankConfigured },
  });

  if (!bankConfigured) {
    return {
      isOperational: false,
      statusLabel: "Casino not configured on this network.",
      maxBetAmount: undefined,
      maxBetCount: undefined,
    };
  }

  if (isLoading || !data) {
    return {
      isOperational: false,
      statusLabel: isError
        ? `Casino bank read failed on this network.`
        : null,
      maxBetAmount: undefined,
      maxBetCount: undefined,
    };
  }

  const [isAllowedToken, maxBetAmount, maxBetCount] = data as unknown as [
    boolean,
    bigint,
    bigint,
  ];

  if (!isAllowedToken) {
    return {
      isOperational: false,
      statusLabel: `${betToken.symbol} bets are currently paused by the bank operator.`,
      maxBetAmount,
      maxBetCount,
    };
  }

  if (maxBetAmount === 0n) {
    return {
      isOperational: false,
      statusLabel: `${betToken.symbol} bank is empty — no bets can be placed until liquidity is added.`,
      maxBetAmount,
      maxBetCount,
    };
  }

  return {
    isOperational: true,
    statusLabel: null,
    maxBetAmount,
    maxBetCount,
  };
}
