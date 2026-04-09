import type { Address } from "viem";
import { isAddress, zeroAddress } from "viem";
import { gnosis, polygon } from "viem/chains";

/** BetSwirl Bank on Polygon (137) — shared across BetSwirl mainnet deployments. */
export const BETSWIRL_BANK_POLYGON =
  "0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA" as const satisfies Address;

/** BetSwirl Coin Toss game on Polygon (137). */
export const BETSWIRL_COIN_TOSS_POLYGON =
  "0xC3Dff2489F8241729B824e23eD01F986fcDf8ec3" as const satisfies Address;

function addressFromEnv(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }
  return value;
}

/**
 * Polygon (137) and Gnosis (100) — same chains as `src/wagmi.ts`.
 * Polygon defaults to live BetSwirl addresses; env overrides apply when set.
 * Gnosis has no default in the current BetSwirl SDK registry — use env when available.
 */
export const CASINO_CHAIN_IDS = [polygon.id, gnosis.id] as const;

export type CasinoChainId = (typeof CASINO_CHAIN_IDS)[number];

const BANK_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_POLYGON) ?? BETSWIRL_BANK_POLYGON,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_GNOSIS),
};

const COIN_TOSS_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]:
    addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_POLYGON) ?? BETSWIRL_COIN_TOSS_POLYGON,
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
