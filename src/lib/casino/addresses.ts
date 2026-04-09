import type { Address } from "viem";
import { isAddress, zeroAddress } from "viem";
import { gnosis, polygon, polygonAmoy } from "viem/chains";

/** BetSwirl Bank — mainnet (all chains share this address). */
export const BETSWIRL_BANK_MAINNET =
  "0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA" as const satisfies Address;

/** BetSwirl Bank — Polygon Amoy testnet. */
export const BETSWIRL_BANK_AMOY =
  "0x89D47048152581633579450DC4888C931CD4c28C" as const satisfies Address;

/** BetSwirl Coin Toss — Polygon mainnet. */
export const BETSWIRL_COIN_TOSS_POLYGON =
  "0xC3Dff2489F8241729B824e23eD01F986fcDf8ec3" as const satisfies Address;

/** BetSwirl Coin Toss — Polygon Amoy testnet. */
export const BETSWIRL_COIN_TOSS_AMOY =
  "0xC2fc743768A1a842dD2CfA121359b8545B9876cA" as const satisfies Address;

function addressFromEnv(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }
  return value;
}

export const CASINO_CHAIN_IDS = [polygon.id, polygonAmoy.id, gnosis.id] as const;

export type CasinoChainId = (typeof CASINO_CHAIN_IDS)[number];

const BANK_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_POLYGON) ?? BETSWIRL_BANK_MAINNET,
  [polygonAmoy.id]: BETSWIRL_BANK_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_GNOSIS),
};

const COIN_TOSS_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]:
    addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_POLYGON) ?? BETSWIRL_COIN_TOSS_POLYGON,
  [polygonAmoy.id]: BETSWIRL_COIN_TOSS_AMOY,
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
