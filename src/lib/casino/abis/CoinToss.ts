import type { Abi } from "viem";
import { coinTossAbi as betSwirlCoinTossAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Coin Toss game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const coinTossAbi = betSwirlCoinTossAbi as unknown as Abi;

export type CoinTossAbi = typeof betSwirlCoinTossAbi;
