"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { AzuroSDKProvider, BetslipProvider as AzuroBetslipProvider } from "@azuro-org/sdk";
import { useState, type ReactNode } from "react";
import { BetslipProvider } from "@/components/Betslip";
import { OddsFormatProvider } from "@/components/OddsFormatProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { BetSettlementToasts } from "@/components/BetSettlementToasts";
import { SettledBetsPrefetchProvider } from "@/components/SettledBetsPrefetchProvider";
import { ToastProvider } from "@/components/Toast";
import { PendingBetsProvider } from "@/components/PendingBetsProvider";
import type { SportsChainId } from "@/lib/sportsChainConstants";
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
  initialAzuroChainId?: SportsChainId;
}) {
  const azuroChainId: SportsChainId = initialAzuroChainId ?? DEFAULT_SPORTS_CHAIN_ID;
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
                    <SettledBetsPrefetchProvider>
                      <BetSettlementToasts />
                      {children}
                    </SettledBetsPrefetchProvider>
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
