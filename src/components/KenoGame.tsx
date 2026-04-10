"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BP_VALUE,
  Keno,
  MAX_HOUSE_EGDE,
  chainNativeCurrencyToToken,
  defaultCasinoGameParams,
  parseRawKenoConfiguration,
  type CasinoChainId,
  type KenoBall,
  type KenoConfiguration,
  type RawKenoConfiguration,
} from "@betswirl/sdk-core";
import { formatEther, isAddress, zeroAddress, parseEther } from "viem";
import { type Chain, gnosis, polygon, polygonAmoy } from "viem/chains";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { KenoAnimation, type KenoPhase } from "@/components/KenoAnimation";
import { useKeno, type KenoBetData } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS } from "@/lib/casino/addresses";

const STAKE_PRESET_ETH = ["0.01", "0.05", "0.1", "0.5", "1"] as const;
const BET_HISTORY_DISPLAY_CAP = 12;
const NATIVE_TOKEN = zeroAddress;

const CHAIN_NAMES: Record<number, string> = {
  137: "Polygon",
  80002: "Polygon Amoy",
  100: "Gnosis",
};

const VIEM_CHAIN_BY_ID: Record<number, Chain> = {
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [gnosis.id]: gnosis,
};

function formatCasinoTxError(error: Error): string {
  const e = error as Error & { shortMessage?: string };
  const text =
    typeof e.shortMessage === "string" && e.shortMessage.trim()
      ? e.shortMessage.trim()
      : (e.message ?? "").trim() || "Transaction failed.";
  if (/msg\.value/i.test(text)) {
    return "Transaction failed. Check your stake covers the minimum and network fees, then try again.";
  }
  return text;
}

const PHASE_LABEL: Record<KenoPhase, string> = {
  idle: "Ready",
  picking: "Ready to play",
  drawing: "Drawing",
  result: "Result",
};

function countMatches(selected: readonly number[], drawn: readonly number[]): number {
  const s = new Set(selected);
  let n = 0;
  for (const d of drawn) {
    if (s.has(d)) n += 1;
  }
  return n;
}

export function KenoGame() {
  const { isConnected, address: connected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const {
    data: minBet,
    isMinBetPending: minBetLoading,
    vrfCost,
    chainTokenConfig,
    kenoConfig: rawKenoConfig,
    placeWager,
    canWager,
    isPending,
    error,
    reset,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
  } = useKeno();

  const [selected, setSelected] = useState<number[]>([]);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<KenoPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenEncoded, setFrozenEncoded] = useState<number>(0);
  const [drawnBalls, setDrawnBalls] = useState<number[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [won, setWon] = useState<boolean | null>(null);
  const [payoutWei, setPayoutWei] = useState<bigint | null>(null);
  const [waitingVrf, setWaitingVrf] = useState(false);
  const rollIdSnapshotRef = useRef<bigint>(BigInt(0));

  const isSupportedChain = (CASINO_CHAIN_IDS as readonly number[]).includes(chainId);

  const { data: receipt, isLoading: receiptLoading } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const minBetWei = minBet ?? BigInt(0);
  const vrfWei = typeof vrfCost === "bigint" ? vrfCost : undefined;

  const nativeToken = useMemo(() => {
    const viemChain = VIEM_CHAIN_BY_ID[chainId];
    return viemChain ? chainNativeCurrencyToToken(viemChain.nativeCurrency) : chainNativeCurrencyToToken(polygon.nativeCurrency);
  }, [chainId]);

  const kenoConfiguration = useMemo((): KenoConfiguration | null => {
    if (!rawKenoConfig || !Array.isArray(rawKenoConfig)) return null;
    const tuple = rawKenoConfig as RawKenoConfiguration;
    try {
      return parseRawKenoConfiguration(tuple, nativeToken, chainId as CasinoChainId);
    } catch {
      return null;
    }
  }, [rawKenoConfig, nativeToken, chainId]);

  const houseEdgeBp = useMemo(() => {
    const cfg = chainTokenConfig as readonly unknown[] | undefined;
    if (!cfg || !Array.isArray(cfg) || typeof cfg[0] !== "number") return undefined;
    return cfg[0];
  }, [chainTokenConfig]);

  const maxBalls = kenoConfiguration?.maxSelectableBalls ?? 0;
  const biggestBall = kenoConfiguration?.biggestSelectableBall ?? 40;

  const winChancePercent = useMemo(() => {
    if (!kenoConfiguration || selected.length === 0) return null;
    let total = 0;
    for (let m = 0; m <= selected.length; m++) {
      total += Keno.getWinChancePercent(kenoConfiguration, selected.length, m);
    }
    return total;
  }, [kenoConfiguration, selected]);

  const multiplierDisplay = useMemo(() => {
    if (!kenoConfiguration || selected.length === 0) return null;
    let best = 0;
    for (let m = 1; m <= selected.length; m++) {
      const fmt = Keno.getFormattedMultiplier(kenoConfiguration, selected.length, m);
      if (fmt > best) best = fmt;
    }
    return best;
  }, [kenoConfiguration, selected]);

  const parsedAmount = useMemo(() => {
    const t = amount.trim();
    const zero = BigInt(0);
    if (!t) return { ok: false as const, wei: zero };
    try {
      return { ok: true as const, wei: parseEther(t) };
    } catch {
      return { ok: false as const, wei: zero };
    }
  }, [amount]);

  const amountError =
    amount.trim() !== "" && !parsedAmount.ok
      ? "Enter a valid number (e.g. 0.01)"
      : null;

  const belowMin =
    parsedAmount.ok &&
    minBet !== undefined &&
    parsedAmount.wei > BigInt(0) &&
    parsedAmount.wei < minBetWei;

  const gridDisabled = !canWager || phase === "drawing" || !kenoConfiguration;

  const toggleBall = useCallback(
    (n: number) => {
      if (gridDisabled || !kenoConfiguration) return;
      setSelected((prev) => {
        const set = new Set(prev);
        if (set.has(n)) {
          set.delete(n);
        } else {
          if (set.size >= kenoConfiguration.maxSelectableBalls) return prev;
          set.add(n);
        }
        return [...set].sort((a, b) => a - b);
      });
    },
    [gridDisabled, kenoConfiguration],
  );

  useEffect(() => {
    if (!parsedAmount.ok || parsedAmount.wei === BigInt(0)) {
      if (phase === "picking") setPhase("idle");
      return;
    }
    if (phase === "idle") setPhase("picking");
  }, [parsedAmount.ok, parsedAmount.wei, phase]);

  useEffect(() => {
    if (!isConnected && phase !== "idle" && phase !== "result") {
      setPhase("idle");
      setTxHash(undefined);
      setWaitingVrf(false);
    }
  }, [isConnected, phase]);

  useEffect(() => {
    if (phase !== "drawing" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;
    if (receipt.status === "reverted") {
      setPhase("picking");
      setTxHash(undefined);
      return;
    }
    setWaitingVrf(true);
    rollIdSnapshotRef.current = lastRoll?.id ?? BigInt(0);
  }, [phase, receipt, receiptLoading, txHash, lastRoll?.id]);

  useEffect(() => {
    if (!waitingVrf || !lastRoll || !kenoConfiguration) return;
    if (lastRoll.id <= rollIdSnapshotRef.current) return;
    if (lastRoll.numbers !== BigInt(frozenEncoded)) return;

    const decoded = Keno.decodeRolled(lastRoll.rolled.map((x) => BigInt(x)) as bigint[]);
    setDrawnBalls([...decoded]);
    setPayoutWei(lastRoll.payout);
    setWon(lastRoll.payout > BigInt(0));
    setWaitingVrf(false);
    setRevealCount(0);
    setPhase("drawing");
  }, [waitingVrf, lastRoll, kenoConfiguration, frozenEncoded]);

  useEffect(() => {
    if (!drawnBalls?.length) {
      if (phase !== "drawing") setRevealCount(0);
      return;
    }
    if (phase !== "drawing") return;
    if (revealCount >= drawnBalls.length) {
      setPhase("result");
      return;
    }
    const id = window.setTimeout(() => {
      setRevealCount((c) => c + 1);
    }, 95);
    return () => window.clearTimeout(id);
  }, [drawnBalls, phase, revealCount]);

  const canSubmit =
    isConnected &&
    canWager &&
    kenoConfiguration &&
    selected.length > 0 &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading &&
    (phase === "idle" || phase === "picking");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || !connected || !kenoConfiguration) return;
      reset?.();
      setDrawnBalls(null);
      setWon(null);
      setPayoutWei(null);
      setRevealCount(0);
      setWaitingVrf(false);

      const encoded = Keno.encodeInput(selected as KenoBall[], kenoConfiguration);
      setFrozenEncoded(encoded);
      setPhase("drawing");
      setTxHash(undefined);

      const envAffiliate = process.env.NEXT_PUBLIC_CASINO_AFFILIATE;
      const affiliate: `0x${string}` =
        envAffiliate && isAddress(envAffiliate) ? envAffiliate : connected;

      const vrf = vrfWei ?? BigInt(0);
      const betAmount =
        parsedAmount.wei > vrf ? parsedAmount.wei - vrf : BigInt(0);
      if (betAmount === BigInt(0)) {
        setPhase("picking");
        return;
      }

      const betData: KenoBetData = {
        token: NATIVE_TOKEN,
        betAmount,
        betCount: defaultCasinoGameParams.betCount,
        stopGain: defaultCasinoGameParams.stopGain,
        stopLoss: defaultCasinoGameParams.stopLoss,
        maxHouseEdge: MAX_HOUSE_EGDE,
      };

      try {
        const hash = await placeWager(BigInt(encoded), connected, affiliate, betData);
        setTxHash(hash);
      } catch {
        setPhase("picking");
        setTxHash(undefined);
      }
    },
    [
      canSubmit,
      connected,
      reset,
      selected,
      placeWager,
      parsedAmount.wei,
      vrfWei,
      kenoConfiguration,
    ],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setDrawnBalls(null);
    setWon(null);
    setPayoutWei(null);
    setRevealCount(0);
    setWaitingVrf(false);
    if (parsedAmount.ok && parsedAmount.wei > BigInt(0)) {
      setPhase("picking");
    } else {
      setPhase("idle");
    }
  }

  function renderCell(n: number) {
    const on = selected.includes(n);
    const atMax = maxBalls > 0 && selected.length >= maxBalls && !on;
    const disabled = gridDisabled || atMax;
    return (
      <button
        key={n}
        type="button"
        disabled={disabled}
        aria-pressed={on}
        onClick={() => toggleBall(n)}
        className={`flex min-h-[36px] min-w-0 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition hover:brightness-110 disabled:opacity-50 sm:min-h-[40px] sm:text-sm ${
          on
            ? "border-emerald-500 bg-emerald-950/60 text-emerald-100 ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950"
            : "border-zinc-700 bg-zinc-900/80 text-zinc-200"
        }`}
      >
        {n}
      </button>
    );
  }

  const ballNumbers = useMemo(
    () => Array.from({ length: biggestBall }, (_, i) => i + 1),
    [biggestBall],
  );

  const animPhase: KenoPhase =
    phase === "result"
      ? "result"
      : phase === "drawing"
        ? "drawing"
        : phase === "picking"
          ? "picking"
          : "idle";

  const animReveal =
    phase === "result" ? (drawnBalls?.length ?? 0) : revealCount;

  return (
    <div className="page-shell">
      <nav className="type-caption mb-6">
        <Link href="/casino" className="text-emerald-400/90 hover:text-emerald-300">
          ← Casino
        </Link>
      </nav>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 lg:mb-10">
          <h1 className="type-display">Keno</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Pick up to {maxBalls || "—"} numbers on the board, set your stake, and draw. Settled
            on-chain with Chainlink VRF.
          </p>
        </header>

        {isConnected && !isSupportedChain ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3">
            <span className="text-sm text-amber-100">
              You&apos;re connected to an unsupported network.
            </span>
            <button
              type="button"
              onClick={() => switchChain?.({ chainId: polygonAmoy.id })}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-500"
            >
              Switch to Polygon Amoy
            </button>
          </div>
        ) : isConnected && isSupportedChain ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-zinc-300">
              {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
            </span>
          </div>
        ) : null}

        {isConnected && isSupportedChain && !canWager ? (
          <p className="type-body mb-8 max-w-xl rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-amber-100">
            Keno is currently paused on this network. Try switching to another supported network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <KenoAnimation
              phase={animPhase}
              drawnBalls={drawnBalls}
              revealCount={animReveal}
              won={won}
              payoutWei={payoutWei}
              className="w-full"
            />
          </div>

          <div className="flex-1 lg:min-w-0">
            <div
              className="mb-4 flex flex-wrap items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span className="type-overline">Status</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  phase === "idle"
                    ? "bg-zinc-800 text-zinc-300"
                    : phase === "picking"
                      ? "bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-700/50"
                      : phase === "drawing"
                        ? "bg-amber-950/80 text-amber-100 ring-1 ring-amber-700/50"
                        : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600"
                }`}
              >
                {PHASE_LABEL[phase]}
              </span>
              {phase === "drawing" ? (
                <span className="type-caption text-zinc-500">
                  {isPending
                    ? "Confirm in your wallet…"
                    : receiptLoading
                      ? "Waiting for on-chain confirmation…"
                      : waitingVrf
                        ? "Bet placed! Waiting for Chainlink VRF result…"
                        : null}
                </span>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
            >
              <fieldset
                className="space-y-5"
                disabled={
                  !canWager || phase === "drawing" || phase === "result" || !kenoConfiguration
                }
              >
                <legend className="sr-only">Bet options</legend>

                <div>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <p className="type-overline">Board</p>
                    <span className="type-caption text-zinc-500">
                      {selected.length}
                      {maxBalls ? ` / ${maxBalls}` : ""} picked
                      {maxBalls ? " (max)" : ""}
                    </span>
                  </div>
                  <div className="grid max-h-[min(52vh,28rem)] grid-cols-8 gap-1 overflow-y-auto overscroll-contain pr-0.5 sm:grid-cols-10 sm:gap-1.5">
                    {ballNumbers.map((n) => renderCell(n))}
                  </div>
                  <p className="type-caption mt-2 text-zinc-600">
                    Tap numbers to add or remove them. You can pick at most {maxBalls || "—"}.
                  </p>
                </div>

                <div>
                  <p className="type-overline mb-2">Payout table (gross ×)</p>
                  {!kenoConfiguration ? (
                    <p className="type-caption text-zinc-500">Loading payout table…</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-950/80">
                            <th className="sticky left-0 z-[1] bg-zinc-950/95 px-2 py-2 font-medium text-zinc-400">
                              Picks \ Hits
                            </th>
                            {Array.from({ length: maxBalls + 1 }, (_, hi) => (
                              <th
                                key={hi}
                                className="px-1.5 py-2 text-center font-mono text-zinc-400"
                              >
                                {hi}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: maxBalls }, (_, pi) => {
                            const picks = pi + 1;
                            return (
                              <tr key={picks} className="border-b border-zinc-800/80">
                                <td className="sticky left-0 z-[1] bg-zinc-950/90 px-2 py-1.5 font-mono text-zinc-300">
                                  {picks}
                                </td>
                                {Array.from({ length: maxBalls + 1 }, (_, hi) => (
                                  <td
                                    key={hi}
                                    className="px-1.5 py-1.5 text-center font-mono tabular-nums text-zinc-400"
                                  >
                                    {hi > picks
                                      ? "—"
                                      : Keno.getMultiplier(kenoConfiguration, picks, hi) === 0
                                        ? "—"
                                        : `${Keno.getFormattedMultiplier(kenoConfiguration, picks, hi)}×`}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="type-caption text-zinc-500">Win chance (any payout)</p>
                    <p className="type-odds text-emerald-300/95">
                      {winChancePercent != null ? `${winChancePercent.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="type-caption text-zinc-500">Best gross mult.</p>
                    <p className="type-odds text-zinc-100">
                      {multiplierDisplay != null ? `${multiplierDisplay.toFixed(3)}×` : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="keno-amount" className="type-overline mb-2 block">
                    Stake
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {STAKE_PRESET_ETH.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setAmount(preset);
                          setPhase("picking");
                        }}
                        className="min-h-[40px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    id="keno-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none ring-emerald-600/0 transition focus:border-zinc-600 focus:ring-2 focus:ring-emerald-600/30"
                  />
                  {parsedAmount.ok && parsedAmount.wei > BigInt(0) && vrfWei !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      Open How it works below for how your payment is split.
                    </p>
                  ) : null}
                  {amountError ? (
                    <p className="type-caption mt-1.5 text-red-400">{amountError}</p>
                  ) : null}
                  {belowMin ? (
                    <p className="type-caption mt-1.5 text-amber-300">
                      Minimum stake is {formatEther(minBetWei)} (covers required fees and minimum
                      bet).
                    </p>
                  ) : null}
                  {minBetLoading ? (
                    <p className="type-caption mt-1.5 text-zinc-600">Loading minimum…</p>
                  ) : canWager && minBet !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      Minimum stake {formatEther(minBetWei)} · Enter an amount to continue.
                    </p>
                  ) : null}
                </div>

                {isConnected && isSupportedChain ? (
                  <div>
                    <p className="type-overline mb-2">Bet history</p>
                    {betHistoryError ? (
                      <p className="type-caption text-amber-300" role="alert">
                        Could not load full history from the network. New bets still appear here
                        after they settle.
                      </p>
                    ) : null}
                    {betHistoryLoading && betHistory.length === 0 ? (
                      <p className="type-caption text-zinc-500">Loading history…</p>
                    ) : betHistory.length === 0 ? (
                      <p className="type-caption text-zinc-500">
                        Your settled bets will show here (synced from chain).
                      </p>
                    ) : (
                      <ul className="space-y-2" aria-label="Keno bet history">
                        {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                          const picked = Keno.decodeInput(Number(row.numbers));
                          const rolled = Keno.decodeRolled(
                            row.rolled.map((x) => BigInt(x)) as bigint[],
                          );
                          const matches = countMatches(picked, rolled);
                          const win = row.payout > BigInt(0);
                          return (
                            <li
                              key={row.id.toString()}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                            >
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span
                                  className={`font-mono text-xs font-semibold ${
                                    win ? "text-emerald-300" : "text-red-300"
                                  }`}
                                >
                                  {matches} hit{matches === 1 ? "" : "s"}
                                </span>
                              </span>
                              <span className="font-mono text-xs text-zinc-400">
                                Bet {formatEther(row.totalBetAmount)} · Payout{" "}
                                {formatEther(row.payout)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}

                <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                  <summary className="cursor-pointer select-none type-caption text-zinc-400">
                    How it works
                  </summary>
                  <div className="type-caption mt-3 space-y-3 border-t border-zinc-800/80 pt-3 text-zinc-500">
                    <ol className="list-decimal space-y-2 pl-4 text-zinc-400">
                      <li>
                        Pick up to {maxBalls || "—"} numbers on the board and enter your stake. Win
                        chance and multipliers follow the on-chain payout table.
                      </li>
                      <li>
                        Confirm in your wallet. The draw uses Chainlink VRF and resolves in a few
                        seconds.
                      </li>
                      <li>
                        {houseEdgeBp !== undefined ? (
                          <>
                            Payouts use the protocol keno table at a house edge of{" "}
                            <span className="font-mono text-zinc-300">
                              {((houseEdgeBp / BP_VALUE) * 100).toFixed(2)}%
                            </span>
                            . The table shows gross multipliers before that edge is applied at
                            settlement.
                          </>
                        ) : (
                          <span className="text-zinc-600">Loading payout rules…</span>
                        )}
                      </li>
                    </ol>
                    {parsedAmount.ok && parsedAmount.wei > BigInt(0) && vrfWei !== undefined ? (
                      <div className="space-y-1 border-t border-zinc-800/80 pt-3">
                        <p className="text-zinc-400">VRF (randomness) breakdown</p>
                        <p>
                          Payment total:{" "}
                          <span className="font-mono text-zinc-300">
                            {formatEther(parsedAmount.wei)}
                          </span>
                        </p>
                        <p>
                          VRF fee:{" "}
                          <span className="font-mono text-zinc-300">{formatEther(vrfWei)}</span>
                        </p>
                        <p>
                          Bet amount:{" "}
                          <span className="font-mono text-zinc-300">
                            {formatEther(
                              parsedAmount.wei > vrfWei ? parsedAmount.wei - vrfWei : BigInt(0),
                            )}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="border-t border-zinc-800/80 pt-3 text-zinc-600">
                        Enter a stake above to see the VRF fee breakdown for your payment.
                      </p>
                    )}
                  </div>
                </details>

                {!isConnected ? (
                  <p className="type-body text-zinc-400">
                    Connect a wallet in the header to place a bet.
                  </p>
                ) : null}

                {error ? (
                  <p className="type-body text-red-400" role="alert">
                    {formatCasinoTxError(error)}
                  </p>
                ) : null}

                {phase === "result" ? (
                  <button
                    type="button"
                    onClick={onPlayAgain}
                    className="w-full min-h-[48px] rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
                  >
                    Play again
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full min-h-[48px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? "Confirm in wallet…" : "Draw"}
                  </button>
                )}
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
