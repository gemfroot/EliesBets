import { polygon, polygonAmoy, gnosis, avalanche, avalancheFuji, base } from "viem/chains";

export const CHAIN_NAMES: Record<number, string> = {
  [polygon.id]: "Polygon",
  [polygonAmoy.id]: "Polygon Amoy",
  [gnosis.id]: "Gnosis",
  [avalanche.id]: "Avalanche",
  [avalancheFuji.id]: "Avalanche Fuji",
  [base.id]: "Base",
};

/** Mainnet chains shown in the header switcher (literal tuple for wagmi `switchChain`). */
export const HEADER_SWITCHER_CHAIN_IDS = [
  polygon.id,
  base.id,
  avalanche.id,
] as const;

/** All wagmi-supported chain IDs (used by WrongNetworkBanner). */
export const SUPPORTED_CHAIN_IDS = [
  polygon.id,
  polygonAmoy.id,
  gnosis.id,
  avalanche.id,
  avalancheFuji.id,
  base.id,
] as const;

/**
 * Preferred chain to suggest for each game when the user is on an unsupported
 * network. First entry is the default; additional entries are alternatives.
 */
export const GAME_PREFERRED_CHAINS: Record<string, readonly number[]> = {
  coinToss: [base.id, avalanche.id, polygon.id],
  dice: [polygon.id],
  roulette: [polygon.id],
  keno: [polygon.id],
  wheel: [base.id, polygon.id],
  plinko: [base.id, polygon.id],
};

export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

const EXPLORER_BY_CHAIN: Record<number, string> = {
  [polygon.id]: "https://polygonscan.com",
  [polygonAmoy.id]: "https://amoy.polygonscan.com",
  [gnosis.id]: "https://gnosisscan.io",
  [avalanche.id]: "https://snowtrace.io",
  [avalancheFuji.id]: "https://testnet.snowtrace.io",
  [base.id]: "https://basescan.org",
};

export function explorerTxUrl(chainId: number, hash: string): string | undefined {
  const baseUrl = EXPLORER_BY_CHAIN[chainId];
  return baseUrl ? `${baseUrl}/tx/${hash}` : undefined;
}
