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
import { PendingBetsProvider } from "@/components/PendingBetsProvider";
import { DEFAULT_SPORTS_CHAIN_ID } from "@/lib/sportsChainConstants";
import { SportsChainSync } from "@/components/SportsChainSync";
import { wagmiConfig } from "./wagmi";

export function Providers({
  children,
  initialState,
  initialAzuroChainId,
}: {
  children: ReactNode;
  initialState?: State;
  /** Must match `appChainId` cookie / `getSportsChainId()` for SSR. */
  initialAzuroChainId?: number;
}) {
  const azuroChainId = initialAzuroChainId ?? DEFAULT_SPORTS_CHAIN_ID;
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
        <AzuroSDKProvider initialChainId={azuroChainId}>
          <SportsChainSync />
          <AzuroBetslipProvider>
            <FavoritesProvider>
              <ToastProvider>
                <PendingBetsProvider>
                  <BetslipProvider>
                    <BetSettlementToasts />
                    {children}
                  </BetslipProvider>
                </PendingBetsProvider>
              </ToastProvider>
            </FavoritesProvider>
          </AzuroBetslipProvider>
        </AzuroSDKProvider>
        </OddsFormatProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
