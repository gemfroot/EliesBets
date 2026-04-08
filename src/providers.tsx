"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { AzuroSDKProvider } from "@azuro-org/sdk";
import { useState, type ReactNode } from "react";
import { BetslipProvider } from "@/components/Betslip";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { BetSettlementToasts } from "@/components/BetSettlementToasts";
import { ToastProvider } from "@/components/Toast";
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
        <AzuroSDKProvider initialChainId={137}>
          <FavoritesProvider>
            <ToastProvider>
              <BetslipProvider>
                <BetSettlementToasts />
                {children}
              </BetslipProvider>
            </ToastProvider>
          </FavoritesProvider>
        </AzuroSDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
