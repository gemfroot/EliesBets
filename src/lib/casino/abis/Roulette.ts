import { rouletteAbi as betSwirlRouletteAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Roulette game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const rouletteAbi = betSwirlRouletteAbi;

export type RouletteAbi = typeof rouletteAbi;
