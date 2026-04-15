"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { polygon, base, avalanche, gnosis } from "viem/chains";
import type { BetToken } from "@/lib/casino/addresses";

/**
 * Chainlink native-token USD price feeds. Addresses are proxy/aggregator
 * contracts that implement `latestRoundData()` returning an int256 answer
 * with 8 decimals (USD cents × 10^6).
 */
const NATIVE_USD_FEED: Record<number, Address> = {
  [polygon.id]: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
  [base.id]: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  [avalanche.id]: "0x0A77230d17318075983913bC2145DB16C7366156",
};

const FEED_DECIMALS = 8;

const AGGREGATOR_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const STALE_SECONDS = 60 * 60 * 6; // 6h — treat older answers as unreliable

function isStablecoin(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s === "USDC" || s === "USDT" || s === "USDT.E" || s === "USDC.E" || s === "USDT_E" || s === "DAI" || s === "XDAI";
}

/**
 * Returns the USD price of one whole unit of `token` on `chainId`, or
 * undefined if no feed is configured / the feed is stale. Stablecoins are
 * assumed to be pegged at $1.
 */
export function useTokenUsdPrice(chainId: number, token: BetToken): number | undefined {
  const stable = isStablecoin(token.symbol);
  const feed = NATIVE_USD_FEED[chainId];
  const needsFeed = !stable && token.isNative && Boolean(feed);

  const { data } = useReadContract({
    address: feed,
    abi: AGGREGATOR_ABI,
    functionName: "latestRoundData",
    query: {
      enabled: needsFeed,
      refetchInterval: 30_000,
      staleTime: 30_000,
    },
  });

  return useMemo(() => {
    if (stable) return 1;
    // Gnosis native xDAI is pegged ~$1.
    if (!token.isNative && chainId === gnosis.id) return 1;
    if (!token.isNative) return undefined;
    if (!data) return undefined;
    const [, answer, , updatedAt] = data as readonly [bigint, bigint, bigint, bigint, bigint];
    if (answer <= BigInt(0)) return undefined;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (nowSec - updatedAt > BigInt(STALE_SECONDS)) return undefined;
    const n = Number(formatUnits(answer, FEED_DECIMALS));
    return Number.isFinite(n) ? n : undefined;
  }, [stable, token.isNative, chainId, data]);
}

/**
 * Format a token amount (in smallest unit) as a USD string like "$3.13" /
 * "$0.02" / "<$0.01". Returns undefined when no price is available.
 */
export function formatUsdFromWei(
  wei: bigint,
  tokenDecimals: number,
  usdPerUnit: number | undefined,
): string | undefined {
  if (usdPerUnit === undefined) return undefined;
  if (wei === BigInt(0)) return "$0.00";
  const units = Number(formatUnits(wei, tokenDecimals));
  if (!Number.isFinite(units)) return undefined;
  const usd = units * usdPerUnit;
  if (usd > 0 && usd < 0.01) return "<$0.01";
  if (usd < 0 && usd > -0.01) return ">-$0.01";
  const sign = usd < 0 ? "-" : "";
  const abs = Math.abs(usd);
  const formatted = abs.toLocaleString(undefined, {
    maximumFractionDigits: abs < 1 ? 4 : 2,
    minimumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}

/** Convert a decimal string (like "0.01") to a USD string given a price. */
export function formatUsdFromDecimalString(
  amount: string,
  usdPerUnit: number | undefined,
): string | undefined {
  if (usdPerUnit === undefined) return undefined;
  const n = Number(amount);
  if (!Number.isFinite(n)) return undefined;
  const usd = n * usdPerUnit;
  if (usd > 0 && usd < 0.01) return "<$0.01";
  const formatted = usd.toLocaleString(undefined, {
    maximumFractionDigits: usd < 1 ? 4 : 2,
    minimumFractionDigits: 2,
  });
  return `$${formatted}`;
}
