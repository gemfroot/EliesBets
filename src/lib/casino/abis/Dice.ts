import { diceAbi as betSwirlDiceAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Dice game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const diceAbi = betSwirlDiceAbi;

export type DiceAbi = typeof diceAbi;
