"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { AzuroSDKProvider, BetslipProvider as AzuroBetslipProvider } from "@azuro-org/sdk";
import { useState, type ReactNode } from "react";
import { BetslipProvider } from "@/components/Betslip";
import { OddsFormatProvider } from "@/components/OddsFormatProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { BetSettlementToasts } from "@/components/BetSettlementToasts";
import { ToastProvider } from "@/components/Toast";
import { CHAIN_ID } from "@/lib/constants";
import { wagmiConfig } from "./wagmi";

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <OddsFormatProvider>
        <AzuroSDKProvider initialChainId={CHAIN_ID}>
          <AzuroBetslipProvider>
            <FavoritesProvider>
              <ToastProvider>
                <BetslipProvider>
                  <BetSettlementToasts />
                  {children}
                </BetslipProvider>
              </ToastProvider>
            </FavoritesProvider>
          </AzuroBetslipProvider>
        </AzuroSDKProvider>
        </OddsFormatProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
