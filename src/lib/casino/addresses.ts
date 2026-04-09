import type { Address } from "viem";
import { isAddress, zeroAddress } from "viem";
import { gnosis, polygon } from "viem/chains";

function addressFromEnv(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }
  return value;
}

/**
 * Polygon (137) and Gnosis (100) — same chains as `src/wagmi.ts`.
 * Set per-deployment env vars; unset values fall back to `zeroAddress` (reads disabled in hooks).
 */
export const CASINO_CHAIN_IDS = [polygon.id, gnosis.id] as const;

export type CasinoChainId = (typeof CASINO_CHAIN_IDS)[number];

const BANK_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_POLYGON),
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_GNOSIS),
};

const COIN_TOSS_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_POLYGON),
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_GNOSIS),
};

export function getCasinoBankAddress(chainId: number): Address {
  const resolved = BANK_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoCoinTossAddress(chainId: number): Address {
  const resolved = COIN_TOSS_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function isCasinoAddressConfigured(address: Address): boolean {
  return address !== zeroAddress;
}
