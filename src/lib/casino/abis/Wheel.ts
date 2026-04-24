import { wheelAbi as betSwirlWheelAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Wheel game ABI.
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const wheelAbi = betSwirlWheelAbi;

export type WheelAbi = typeof wheelAbi;
