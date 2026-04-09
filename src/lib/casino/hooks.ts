"use client";

import { useCallback, useMemo } from "react";
import type { Address } from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { bankAbi } from "@/lib/casino/abis/Bank";
import { coinTossAbi } from "@/lib/casino/abis/CoinToss";
import {
  getCasinoBankAddress,
  getCasinoCoinTossAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
import type { CasinoContracts } from "@/lib/casino/types";

export function useCasinoContracts(): CasinoContracts {
  const chainId = useChainId();
  const bank = useMemo(() => getCasinoBankAddress(chainId), [chainId]);
  const coinToss = useMemo(() => getCasinoCoinTossAddress(chainId), [chainId]);
  return {
    chainId,
    bank,
    coinToss,
    bankConfigured: isCasinoAddressConfigured(bank),
    coinTossConfigured: isCasinoAddressConfigured(coinToss),
  };
}

export function useBankBalanceOf(account?: Address) {
  const { bank, bankConfigured } = useCasinoContracts();
  const { address: connected } = useAccount();
  const target = account ?? connected;

  return useReadContract({
    address: bank,
    abi: bankAbi,
    functionName: "balanceOf",
    args: target ? [target] : undefined,
    query: {
      enabled: Boolean(bankConfigured && target),
    },
  });
}

export function useCoinTossMinBet() {
  const { coinToss, coinTossConfigured } = useCasinoContracts();

  return useReadContract({
    address: coinToss,
    abi: coinTossAbi,
    functionName: "minBet",
    query: {
      enabled: coinTossConfigured,
    },
  });
}

export function useBankDeposit() {
  const { bank, bankConfigured } = useCasinoContracts();
  const { writeContractAsync, ...rest } = useWriteContract();

  const deposit = useCallback(
    (valueWei: bigint) =>
      writeContractAsync({
        address: bank,
        abi: bankAbi,
        functionName: "deposit",
        value: valueWei,
      }),
    [bank, writeContractAsync],
  );

  return {
    deposit,
    canDeposit: bankConfigured,
    ...rest,
  };
}

export function useBankWithdraw() {
  const { bank, bankConfigured } = useCasinoContracts();
  const { writeContractAsync, ...rest } = useWriteContract();

  const withdraw = useCallback(
    (amount: bigint) =>
      writeContractAsync({
        address: bank,
        abi: bankAbi,
        functionName: "withdraw",
        args: [amount],
      }),
    [bank, writeContractAsync],
  );

  return {
    withdraw,
    canWithdraw: bankConfigured,
    ...rest,
  };
}

export function useCoinTossPlay() {
  const { coinToss, coinTossConfigured } = useCasinoContracts();
  const { writeContractAsync, ...rest } = useWriteContract();

  const play = useCallback(
    (betHeads: boolean, valueWei: bigint) =>
      writeContractAsync({
        address: coinToss,
        abi: coinTossAbi,
        functionName: "play",
        args: [betHeads],
        value: valueWei,
      }),
    [coinToss, writeContractAsync],
  );

  return {
    play,
    canPlay: coinTossConfigured,
    ...rest,
  };
}
