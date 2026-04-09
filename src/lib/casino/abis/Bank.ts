import type { Abi } from "viem";
import { bankAbi as betSwirlBankAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Bank contract ABI (same on Polygon mainnet as other BetSwirl mainnets).
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const bankAbi = betSwirlBankAbi as unknown as Abi;

export type BankAbi = typeof betSwirlBankAbi;
