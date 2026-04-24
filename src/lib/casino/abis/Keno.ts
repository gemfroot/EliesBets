import { kenoAbi as betSwirlKenoAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Keno game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const kenoAbi = betSwirlKenoAbi;

export type KenoAbi = typeof kenoAbi;
