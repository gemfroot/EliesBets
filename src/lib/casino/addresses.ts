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

/** BetSwirl Dice — Polygon mainnet. */
export const BETSWIRL_DICE_POLYGON =
  "0xAa4D2931a9fE14c3dec8AC3f12923Cbb535C0e5f" as const satisfies Address;

/** BetSwirl Dice — Polygon Amoy testnet. */
export const BETSWIRL_DICE_AMOY =
  "0xE14E752c6Ef78fB54da5A28ff7C9f808534603e9" as const satisfies Address;

/** BetSwirl Roulette — Polygon mainnet. */
export const BETSWIRL_ROULETTE_POLYGON =
  "0x6678e3B4AB2a8C8Cdd068F132C21293CcBda33cb" as const satisfies Address;

/** BetSwirl Roulette — Polygon Amoy testnet. */
export const BETSWIRL_ROULETTE_AMOY =
  "0x5F628ccd0D5929B16fF6E239D8BB8C81F1b0feD9" as const satisfies Address;

/** BetSwirl Keno — Polygon mainnet. */
export const BETSWIRL_KENO_POLYGON =
  "0xc3428E4FEb5C770Db51DCb9B1C08223B10994a89" as const satisfies Address;

/** BetSwirl Keno — Polygon Amoy testnet. */
export const BETSWIRL_KENO_AMOY =
  "0x77A654D0895baF09c42314FBb4b18822Ec3c1DD0" as const satisfies Address;

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

const DICE_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_POLYGON) ?? BETSWIRL_DICE_POLYGON,
  [polygonAmoy.id]: BETSWIRL_DICE_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_GNOSIS),
};

const ROULETTE_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]:
    addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_POLYGON) ?? BETSWIRL_ROULETTE_POLYGON,
  [polygonAmoy.id]: BETSWIRL_ROULETTE_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_GNOSIS),
};

const KENO_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_POLYGON) ?? BETSWIRL_KENO_POLYGON,
  [polygonAmoy.id]: BETSWIRL_KENO_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_GNOSIS),
};

export function getCasinoBankAddress(chainId: number): Address {
  const resolved = BANK_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoCoinTossAddress(chainId: number): Address {
  const resolved = COIN_TOSS_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoDiceAddress(chainId: number): Address {
  const resolved = DICE_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoRouletteAddress(chainId: number): Address {
  const resolved = ROULETTE_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoKenoAddress(chainId: number): Address {
  const resolved = KENO_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function isCasinoAddressConfigured(address: Address): boolean {
  return address !== zeroAddress;
}
