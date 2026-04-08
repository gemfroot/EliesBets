"use client";

import {
  useBalance,
  useChainId,
  useChains,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { useState } from "react";
import { formatUnits } from "viem";
import { ConnectModal } from "@/components/ConnectModal";
import { SearchBar } from "@/components/SearchBar";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatNativeBalance(
  value: bigint,
  decimals: number,
  symbol: string,
): string {
  const s = formatUnits(value, decimals);
  const n = Number(s);
  if (!Number.isFinite(n)) return `${s} ${symbol}`;
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `<0.0001 ${symbol}`;
  const rounded = n.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: n < 1 ? 2 : 0,
  });
  return `${rounded} ${symbol}`;
}

export function Header() {
  const [modalOpen, setModalOpen] = useState(false);
  const { address, isConnected, status } = useConnection();
  const chainId = useChainId();
  const chains = useChains();
  const { disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { data: balance, isLoading: balanceLoading } = useBalance({
    address,
    query: { enabled: Boolean(address && isConnected) },
  });

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4">
      <span className="shrink-0 text-lg font-semibold tracking-tight text-zinc-50">
        EliesBets
      </span>

      <div className="min-w-0 flex-1 px-1">
        <SearchBar />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {isConnected && address ? (
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="hidden sm:inline">Network</span>
              <select
                value={chainId}
                onChange={(e) => {
                  const next = chains.find(
                    (c) => String(c.id) === e.target.value,
                  )?.id;
                  if (next !== undefined) switchChain({ chainId: next });
                }}
                disabled={isSwitchingChain}
                className="max-w-[10rem] rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 font-medium text-zinc-100 disabled:opacity-60 sm:max-w-none"
                aria-label="Switch network"
              >
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <span className="font-mono text-sm text-zinc-300">
              {formatAddress(address)}
            </span>

            <span
              className="text-sm tabular-nums text-zinc-400"
              title={balance ? formatUnits(balance.value, balance.decimals) : undefined}
            >
              {balanceLoading
                ? "…"
                : balance
                  ? formatNativeBalance(
                      balance.value,
                      balance.decimals,
                      balance.symbol,
                    )
                  : "—"}
            </span>

            <button
              type="button"
              onClick={() => disconnect()}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={status === "connecting"}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-60"
          >
            {status === "connecting" ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>

      <ConnectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </header>
  );
}
