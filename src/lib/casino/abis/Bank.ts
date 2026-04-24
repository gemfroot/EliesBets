import { bankAbi as betSwirlBankAbi } from "@betswirl/sdk-core";

/**
 * BetSwirl Bank contract ABI (same on Polygon mainnet as other BetSwirl mainnets).
 * Sourced from `@betswirl/sdk-core` — keep the dependency version aligned with protocol updates.
 */
export const bankAbi = betSwirlBankAbi;

export type BankAbi = typeof bankAbi;
