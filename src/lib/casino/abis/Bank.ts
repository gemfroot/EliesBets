import type { Abi } from "viem";

/**
 * Bank vault ABI — keep in sync with the deployed Bank contract.
 * Regenerate from `artifacts/contracts/Bank.sol/Bank.json` (or equivalent) after deploy.
 */
export const bankAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
] as const satisfies Abi;

export type BankAbi = typeof bankAbi;
