"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useChain } from "@azuro-org/sdk";
import { useRouter } from "next/navigation";
import { useBalance, useChainId, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { MyBetsLink } from "@/components/MyBetsLink";
import { PendingBetsIndicator } from "@/components/PendingBetsIndicator";
import { HEADER_SWITCHER_CHAIN_IDS, SUPPORTED_CHAIN_IDS, chainName } from "@/lib/chains";

const ConnectModal = dynamic(
  () =>
    import("@/components/ConnectModal").then((m) => ({
      default: m.ConnectModal,
    })),
  { ssr: false },
);
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { SearchBar } from "@/components/SearchBar";
import type { OddsFormat } from "@/lib/oddsFormat";

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

const ODDS_FORMAT_OPTIONS: { value: OddsFormat; label: string }[] = [
  { value: "decimal", label: "Decimal" },
  { value: "fractional", label: "Fractional" },
  { value: "american", label: "American" },
];

export function Header() {
  const router = useRouter();
  const { setAppChainId } = useChain();
  const { format: oddsFormat, setFormat: setOddsFormat } = useOddsFormat();
  const [modalOpen, setModalOpen] = useState(false);
  const { address, isConnected, status } = useConnection();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switchPending, error: switchError } =
    useSwitchChain();
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const chainMenuRef = useRef<HTMLDivElement | null>(null);
  const [switchErrorMsg, setSwitchErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!chainMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (!chainMenuRef.current?.contains(e.target as Node)) {
        setChainMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [chainMenuOpen]);

  useEffect(() => {
    if (!switchError) return;
    const e = switchError as Error & { shortMessage?: string };
    const msg = (e.shortMessage ?? e.message ?? "Failed to switch network").trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync error toast from async mutation
    setSwitchErrorMsg(msg);
    const id = setTimeout(() => setSwitchErrorMsg(null), 5000);
    return () => clearTimeout(id);
  }, [switchError]);

  const { data: balance, isLoading: balanceLoading } = useBalance({
    address,
    query: { enabled: Boolean(address && isConnected) },
  });

  const isUnsupported = isConnected && !SUPPORTED_CHAIN_IDS.includes(chainId);

  const chainPill = (
    <div ref={chainMenuRef} className="relative">
      <button
        type="button"
        onClick={() => isConnected && setChainMenuOpen((o) => !o)}
        disabled={!isConnected || switchPending}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-default disabled:opacity-80 ${
          isUnsupported
            ? "border-amber-700 bg-amber-950/70 text-amber-100 hover:border-amber-500"
            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
        }`}
        aria-haspopup={isConnected ? "menu" : undefined}
        aria-expanded={isConnected ? chainMenuOpen : undefined}
        title={isConnected ? "Switch network" : "Connect a wallet to switch network"}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isUnsupported ? "bg-amber-400" : isConnected ? "bg-emerald-500" : "bg-zinc-500"
          }`}
        />
        <span>{isUnsupported ? "Unsupported" : chainName(chainId)}</span>
        {isConnected ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="text-zinc-400">
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
      {chainMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[9rem] overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
        >
          {HEADER_SWITCHER_CHAIN_IDS.map((id) => {
            const active = id === chainId;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  void (async () => {
                    setChainMenuOpen(false);
                    setSwitchErrorMsg(null);
                    if (active) return;
                    try {
                      await switchChainAsync({ chainId: id });
                      setAppChainId(id);
                      router.refresh();
                    } catch {
                      /* wagmi surfaces switchError */
                    }
                  })();
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition hover:bg-zinc-800 ${active ? "text-emerald-400" : "text-zinc-300"}`}
              >
                <span>{chainName(id)}</span>
                {active ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-tight text-zinc-50 transition hover:text-zinc-200"
        >
          EliesBets
        </Link>

        <div
          className="flex min-w-0 flex-1 items-center justify-center px-1"
          data-header-search
        >
          <SearchBar />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <label className="hidden items-center gap-1.5 text-xs text-zinc-500 md:flex">
            <span className="hidden sm:inline">Odds</span>
            <select
              value={oddsFormat}
              onChange={(e) => setOddsFormat(e.target.value as OddsFormat)}
              aria-label="Odds format"
              className="max-w-[9.5rem] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs font-medium text-zinc-200 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {ODDS_FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <MyBetsLink variant="header" />
          <PendingBetsIndicator />
          {chainPill}
          {isConnected && address ? (
            <>
              <span className="hidden font-mono text-sm text-zinc-300 sm:inline">
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
                <span className="hidden sm:inline">Disconnect</span>
                <span className="sm:hidden" aria-label="Disconnect">×</span>
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

        {modalOpen ? (
          <ConnectModal open onClose={() => setModalOpen(false)} />
        ) : null}
      </header>

      {switchErrorMsg ? (
        <div
          role="alert"
          className="border-b border-amber-700/50 bg-amber-950/80 px-4 py-1.5 text-center text-xs text-amber-100"
        >
          {switchErrorMsg}
        </div>
      ) : null}
    </>
  );
}
