"use client";

import { useChainId, useConnection, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/lib/constants";

export function WrongNetworkBanner() {
  const { isConnected } = useConnection();
  const chainId = useChainId();
  const { mutate: switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === CHAIN_ID) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-700/50 bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100"
    >
      <span>
        Your wallet is on the wrong network. Switch to Polygon to use EliesBets.
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId: CHAIN_ID })}
        className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
      >
        {isPending ? "Switching…" : "Switch network"}
      </button>
    </div>
  );
}
