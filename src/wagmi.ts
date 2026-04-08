import { createConfig, http } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { polygon, gnosis } from "viem/chains";

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
  chains: [polygon, gnosis],
  connectors,
  transports: {
    [polygon.id]: http(),
    [gnosis.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
