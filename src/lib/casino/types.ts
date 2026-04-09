import type { Address, Hex } from "viem";

export type CasinoTxHash = Hex;

export type CasinoContracts = {
  chainId: number;
  bank: Address;
  coinToss: Address;
  bankConfigured: boolean;
  coinTossConfigured: boolean;
};
