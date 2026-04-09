import type { Abi } from "viem";

/**
 * Coin toss game ABI — keep in sync with the deployed CoinToss contract.
 * Regenerate from `artifacts/contracts/CoinToss.sol/CoinToss.json` (or equivalent) after deploy.
 */
export const coinTossAbi = [
  {
    type: "function",
    name: "play",
    stateMutability: "payable",
    inputs: [{ name: "betHeads", type: "bool", internalType: "bool" }],
    outputs: [{ name: "won", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "minBet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
] as const satisfies Abi;

export type CoinTossAbi = typeof coinTossAbi;
