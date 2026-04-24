import { coinTossAbi as betSwirlCoinTossAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Coin Toss game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const coinTossAbi = betSwirlCoinTossAbi;

export type CoinTossAbi = typeof coinTossAbi;
