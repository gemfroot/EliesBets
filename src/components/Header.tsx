"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useBalance, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { MyBetsLink } from "@/components/MyBetsLink";
import { PendingBetsIndicator } from "@/components/PendingBetsIndicator";
import {
  HEADER_SWITCHER_CHAIN_IDS,
  SUPPORTED_CHAIN_IDS,
  chainName,
} from "@/lib/chains";
import { useWalletChainId } from "@/lib/useWalletChainId";
import {
  CHAIN_SLUGS,
  type SportsChainId,
} from "@/lib/sportsChainConstants";
import { rewriteChainInPath } from "@/lib/chainRoute";

const ConnectModal = dynamic(
  () =>
    import("@/components/ConnectModal").then((m) => ({
      default: m.ConnectModal,
    })),
  { ssr: false },
);
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { formatWalletTxError } from "@/lib/userFacingTxError";
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
  { value: "american", label: "American" },
  { value: "decimal", label: "Decimal" },
  { value: "fractional", label: "Fractional" },
];

export function Header() {
  const { format: oddsFormat, setFormat: setOddsFormat } = useOddsFormat();
  const [modalOpen, setModalOpen] = useState(false);
  const { address, isConnected, status } = useConnection();
  const { disconnect } = useDisconnect();
  const chainId = useWalletChainId();
  const { switchChainAsync, isPending: switchPending, error: switchError } =
    useSwitchChain();
  const pathname = usePathname();
  const router = useRouter();
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const chainMenuRef = useRef<HTMLDivElement | null>(null);
  const [switchErrorMsg, setSwitchErrorMsg] = useState<string | null>(null);

  // See `src/lib/chainRoute.ts` for the routing decisions per-page.

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
    const msg = formatWalletTxError(switchError);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync error toast from async mutation
    setSwitchErrorMsg(msg);
    const id = setTimeout(() => setSwitchErrorMsg(null), 5000);
    return () => clearTimeout(id);
  }, [switchError]);

  const { data: balance, isLoading: balanceLoading } = useBalance({
    address,
    query: { enabled: Boolean(address && isConnected) },
  });

  const isUnsupported =
    isConnected &&
    chainId !== undefined &&
    !(SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);

  // Resolved up here so the chainPill JSX (below) can reference it.
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const currentChainSlug =
    firstSegment && (CHAIN_SLUGS as readonly string[]).includes(firstSegment)
      ? firstSegment
      : null;

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
        aria-describedby={!isConnected ? "header-chain-pill-help" : undefined}
        title={
          !isConnected
            ? "Connect a wallet to switch network"
            : isUnsupported
              ? `${chainName(chainId)} isn’t supported — open this menu to switch to Polygon, Gnosis, or Base`
              : "Switch network"
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isUnsupported ? "bg-amber-400" : isConnected ? "bg-emerald-500" : "bg-zinc-500"
          }`}
        />
        <span>
          {isUnsupported
            ? "Unsupported"
            : chainId !== undefined
              ? chainName(chainId)
              : // Not connected yet — fall back to the chain the user is
                // actually browsing (from the URL) so the pill doesn't read
                // "—" while the page is clearly on Polygon/Gnosis/Base.
                currentChainSlug
                ? currentChainSlug.charAt(0).toUpperCase() + currentChainSlug.slice(1)
                : "—"}
        </span>
        {switchPending ? (
          <svg
            className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : isConnected ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="text-zinc-400">
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
      {chainMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 max-h-[min(12rem,70vh)] min-w-[9rem] overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
        >
          {HEADER_SWITCHER_CHAIN_IDS.map((id) => {
            const active = chainId !== undefined && id === chainId;
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
                    // Navigate the URL first so the displayed chain updates
                    // immediately via ChainParamBinder, even if the wallet
                    // switch is denied or hangs. Skip the redundant
                    // setAppChainId — URL is the single source of truth now.
                    const nextPath = rewriteChainInPath(pathname, id);
                    if (nextPath) {
                      router.push(nextPath);
                    }
                    try {
                      await switchChainAsync({ chainId: id });
                    } catch {
                      /* wagmi surfaces switchError; user can retry from the
                         Betslip's "Switch wallet" button at bet time. */
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

  const homeHref = currentChainSlug ? `/${currentChainSlug}` : "/";

  return (
    <>
      <span id="header-chain-pill-help" className="sr-only">
        Connect a wallet to switch sports betting network.
      </span>
      <header className="relative z-50 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
        <Link
          href={homeHref}
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
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-60 sm:px-4"
            >
              {status === "connecting" ? (
                "Connecting…"
              ) : (
                <>
                  <span className="hidden sm:inline">Connect wallet</span>
                  <span className="sm:hidden">Connect</span>
                </>
              )}
            </button>
          )}
        </div>

        {modalOpen ? (
          <ConnectModal open onClose={() => setModalOpen(false)} />
        ) : null}
      </header>

      {isUnsupported ? (
        <div
          role="status"
          className="border-b border-amber-800/60 bg-amber-950/90 px-4 py-2 text-center text-xs leading-snug text-amber-50"
        >
          You&apos;re on <strong>{chainName(chainId)}</strong>, which isn&apos;t used for sports
          here. Open the <strong>network</strong> control in the header and switch to{" "}
          <strong>Polygon</strong>, <strong>Gnosis</strong>, or <strong>Base</strong>.
        </div>
      ) : null}

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
