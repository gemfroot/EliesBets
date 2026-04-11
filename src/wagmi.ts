import { createConfig, http } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { polygon, polygonAmoy, gnosis, avalanche, avalancheFuji } from "viem/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = [
  injected(),
  metaMask(),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy, gnosis, avalanche, avalancheFuji],
  connectors,
  transports: {
    [polygon.id]: http(),
    [polygonAmoy.id]: http("https://polygon-amoy-bor-rpc.publicnode.com"),
    [gnosis.id]: http(),
    [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
