import type { Abi } from "viem";
import { kenoAbi as betSwirlKenoAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Keno game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const kenoAbi = betSwirlKenoAbi as unknown as Abi;

export type KenoAbi = typeof betSwirlKenoAbi;
