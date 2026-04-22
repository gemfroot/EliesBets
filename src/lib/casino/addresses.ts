import type { Address } from "viem";
import { isAddress, zeroAddress } from "viem";
import { gnosis, polygon, polygonAmoy, avalanche, avalancheFuji, base } from "viem/chains";

// ---------------------------------------------------------------------------
// Bet token type — drives the token selector and formatting logic
// ---------------------------------------------------------------------------

export type BetToken = {
  address: Address;
  symbol: string;
  decimals: number;
  isNative: boolean;
};

const BET_TOKENS_BY_CHAIN: Partial<Record<number, BetToken[]>> = {
  [polygon.id]: [
    { address: zeroAddress, symbol: "POL", decimals: 18, isNative: true },
  ],
  [polygonAmoy.id]: [
    { address: zeroAddress, symbol: "POL", decimals: 18, isNative: true },
  ],
  [gnosis.id]: [
    { address: zeroAddress, symbol: "xDAI", decimals: 18, isNative: true },
  ],
  [avalanche.id]: [
    { address: zeroAddress, symbol: "AVAX", decimals: 18, isNative: true },
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6, isNative: false },
    { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDt", decimals: 6, isNative: false },
  ],
  [avalancheFuji.id]: [
    { address: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846", symbol: "LINK", decimals: 18, isNative: false },
  ],
  [base.id]: [
    { address: zeroAddress, symbol: "ETH", decimals: 18, isNative: true },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, isNative: false },
  ],
};

export function getBetTokens(chainId: number): BetToken[] {
  return BET_TOKENS_BY_CHAIN[chainId] ?? [
    { address: zeroAddress, symbol: "ETH", decimals: 18, isNative: true },
  ];
}

export function getDefaultBetToken(chainId: number): BetToken {
  return getBetTokens(chainId)[0];
}

// ---------------------------------------------------------------------------
// Contract addresses
// ---------------------------------------------------------------------------

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

/** BetSwirl Wheel — Polygon mainnet. */
export const BETSWIRL_WHEEL_POLYGON =
  "0xdec2A4f75c5fAE4a09c83975681CE1Dd1dff764b" as const satisfies Address;

/** BetSwirl Wheel — Polygon Amoy testnet. */
export const BETSWIRL_WHEEL_AMOY =
  "0xd300a3757dDBb3Eafb8fb3e401a5eb60e4a571b1" as const satisfies Address;

/** BetSwirl Plinko — Polygon mainnet. */
export const BETSWIRL_PLINKO_POLYGON =
  "0xdec2A4f75c5fAE4a09c83975681CE1Dd1dff764b" as const satisfies Address;

/** BetSwirl Plinko — Polygon Amoy testnet. */
export const BETSWIRL_PLINKO_AMOY =
  "0xd300a3757dDBb3Eafb8fb3e401a5eb60e4a571b1" as const satisfies Address;

/** Our Bank — Avalanche mainnet. */
export const OUR_BANK_AVALANCHE =
  "0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B" as const satisfies Address;

/** Our CoinToss — Avalanche mainnet. */
export const OUR_COIN_TOSS_AVALANCHE =
  "0x423D077cA13b463eb890B7f278F5A20f258B2b50" as const satisfies Address;

/** Our Bank — Base mainnet. */
export const OUR_BANK_BASE =
  "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96" as const satisfies Address;

/** Our CoinToss — Base mainnet. */
export const OUR_COIN_TOSS_BASE =
  "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41" as const satisfies Address;

/** Our WeightedGame (Wheel + Plinko) — Base mainnet. */
export const OUR_WEIGHTED_GAME_BASE =
  "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23" as const satisfies Address;

/** Our forked Bank — Avalanche Fuji testnet. */
export const OUR_BANK_FUJI =
  "0xa630496e3d1ff7353768cc7f94b2881500dd8010" as const satisfies Address;

/** Our forked CoinToss — Avalanche Fuji testnet. */
export const OUR_COIN_TOSS_FUJI =
  "0x06458ff96e9d9ba5a4c9848ff97681f5c8af7382" as const satisfies Address;

function addressFromEnv(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }
  return value;
}

export const CASINO_CHAIN_IDS = [
  polygon.id, polygonAmoy.id, gnosis.id, avalanche.id, avalancheFuji.id, base.id,
] as const;

export type CasinoChainId = (typeof CASINO_CHAIN_IDS)[number];

const BANK_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_POLYGON) ?? BETSWIRL_BANK_MAINNET,
  [polygonAmoy.id]: BETSWIRL_BANK_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_AVALANCHE) ?? OUR_BANK_AVALANCHE,
  [avalancheFuji.id]: OUR_BANK_FUJI,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_BASE) ?? OUR_BANK_BASE,
};

const COIN_TOSS_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]:
    addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_POLYGON) ?? BETSWIRL_COIN_TOSS_POLYGON,
  [polygonAmoy.id]: BETSWIRL_COIN_TOSS_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_AVALANCHE) ?? OUR_COIN_TOSS_AVALANCHE,
  [avalancheFuji.id]: OUR_COIN_TOSS_FUJI,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_COIN_TOSS_BASE) ?? OUR_COIN_TOSS_BASE,
};

// BetSwirl redeployed the full game stack at the *same* addresses on Base as on
// Polygon (CREATE2-style deterministic deploy). So the `BETSWIRL_*_POLYGON`
// constants double as the canonical Base fallbacks for Dice / Roulette / Keno —
// we haven't shipped our own forks of those games on Base yet. These games are
// backed by BetSwirl's Bank (not ours); see `getCasinoBankForGame` below.
const DICE_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_POLYGON) ?? BETSWIRL_DICE_POLYGON,
  [polygonAmoy.id]: BETSWIRL_DICE_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_AVALANCHE),
  [avalancheFuji.id]: undefined,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_DICE_BASE) ?? BETSWIRL_DICE_POLYGON,
};

const ROULETTE_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]:
    addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_POLYGON) ?? BETSWIRL_ROULETTE_POLYGON,
  [polygonAmoy.id]: BETSWIRL_ROULETTE_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_AVALANCHE),
  [avalancheFuji.id]: undefined,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_ROULETTE_BASE) ?? BETSWIRL_ROULETTE_POLYGON,
};

const KENO_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_POLYGON) ?? BETSWIRL_KENO_POLYGON,
  [polygonAmoy.id]: BETSWIRL_KENO_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_AVALANCHE),
  [avalancheFuji.id]: undefined,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_KENO_BASE) ?? BETSWIRL_KENO_POLYGON,
};

const WHEEL_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_WHEEL_POLYGON) ?? BETSWIRL_WHEEL_POLYGON,
  [polygonAmoy.id]: BETSWIRL_WHEEL_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_WHEEL_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_WHEEL_AVALANCHE),
  [avalancheFuji.id]: undefined,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_WHEEL_BASE) ?? OUR_WEIGHTED_GAME_BASE,
};

const PLINKO_BY_CHAIN: Record<CasinoChainId, Address | undefined> = {
  [polygon.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_PLINKO_POLYGON) ?? BETSWIRL_PLINKO_POLYGON,
  [polygonAmoy.id]: BETSWIRL_PLINKO_AMOY,
  [gnosis.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_PLINKO_GNOSIS),
  [avalanche.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_PLINKO_AVALANCHE),
  [avalancheFuji.id]: undefined,
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_PLINKO_BASE) ?? OUR_WEIGHTED_GAME_BASE,
};

export function getCasinoBankAddress(chainId: number): Address {
  const resolved = BANK_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export type CasinoGame =
  | "coinToss"
  | "dice"
  | "roulette"
  | "keno"
  | "wheel"
  | "plinko";

/**
 * Bank address to pre-flight a given game against. On Base we run our own
 * CoinToss + WeightedGame (Wheel/Plinko) backed by our bank, but Dice /
 * Roulette / Keno are BetSwirl's mainnet contracts reused via identical
 * deterministic addresses — those games settle against BetSwirl's bank.
 * Asking our bank about BetSwirl games (or vice versa) returns meaningless
 * `getBetRequirements` results and produces false "bank empty" warnings.
 */
export function getCasinoBankForGame(chainId: number, game: CasinoGame): Address {
  if (chainId === base.id) {
    if (game === "dice" || game === "roulette" || game === "keno") {
      return BETSWIRL_BANK_MAINNET;
    }
  }
  return getCasinoBankAddress(chainId);
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

export function getCasinoWheelAddress(chainId: number): Address {
  const resolved = WHEEL_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function getCasinoPlinkoAddress(chainId: number): Address {
  const resolved = PLINKO_BY_CHAIN[chainId as CasinoChainId];
  return resolved ?? zeroAddress;
}

export function isCasinoAddressConfigured(address: Address): boolean {
  return address !== zeroAddress;
}
