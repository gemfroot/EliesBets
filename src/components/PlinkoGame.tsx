"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BP_VALUE,
  MAX_HOUSE_EGDE,
  Plinko,
  defaultCasinoGameParams,
  type WeightedGameConfiguration,
} from "@betswirl/sdk-core";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { base } from "viem/chains";
import { PlinkoAnimation, type PlinkoPhase } from "@/components/PlinkoAnimation";
import { usePlinko, type WheelBetData } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS, getBetTokens, type BetToken } from "@/lib/casino/addresses";
import { chainName, explorerTxUrl } from "@/lib/chains";

const BET_HISTORY_DISPLAY_CAP = 12;

const PHASE_LABEL: Record<PlinkoPhase, string> = {
  idle: "Ready",
  picking: "Ready to play",
  dropping: "Dropping",
  result: "Result",
};

const STAKE_PRESETS_BY_SYMBOL: Record<string, string[]> = {
  AVAX: ["0.1", "0.5", "1", "5"],
  ETH: ["0.001", "0.005", "0.01", "0.05"],
  USDC: ["1", "5", "10", "25"],
  USDt: ["1", "5", "10", "25"],
  LINK: ["0.01", "0.05", "0.1", "0.5"],
  POL: ["1", "5", "10", "50"],
  xDAI: ["1", "5", "10", "50"],
};
const DEFAULT_PRESETS = ["0.01", "0.05", "0.1", "0.5", "1"];

const FALLBACK_BUCKET_COLORS = [
  "#0d9488",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
  "#2563eb",
  "#ca8a04",
  "#16a34a",
  "#dc2626",
] as const;

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

function bucketVisualsForConfig(cfg: WeightedGameConfiguration | undefined, houseEdgeBp: number) {
  if (!cfg) return [];
  const sorted = Plinko.getSortedPlinkoOutputs(cfg, houseEdgeBp);
  return sorted.map((row, i) => ({
    label: `${row.formattedNetMultiplier.toFixed(2)}×`,
    color: row.color || FALLBACK_BUCKET_COLORS[i % FALLBACK_BUCKET_COLORS.length],
  }));
}

export function PlinkoGame() {
  const { isConnected, address: connected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const availableTokens = useMemo(() => getBetTokens(chainId), [chainId]);
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const selectedToken: BetToken = availableTokens[selectedTokenIdx] ?? availableTokens[0];

  useEffect(() => {
    setSelectedTokenIdx(0);
  }, [chainId]);

  const {
    data: minBet,
    isMinBetPending: minBetLoading,
    vrfCost,
    chainTokenConfig,
    betToken,
    placeWager,
    canWager,
    isPending,
    error,
    reset,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
    refreshRolls,
    plinkoConfigs,
    plinkoConfigsLoading,
  } = usePlinko(selectedToken);

  const stakePresets = STAKE_PRESETS_BY_SYMBOL[betToken.symbol] ?? DEFAULT_PRESETS;

  const [selectedConfigId, setSelectedConfigId] = useState(0);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<PlinkoPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenConfigId, setFrozenConfigId] = useState(0);
  const [outcomeIndex, setOutcomeIndex] = useState<number | null>(null);
  const [decodedOutcome, setDecodedOutcome] = useState<string | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [payoutWei, setPayoutWei] = useState<bigint | null>(null);
  const [waitingVrf, setWaitingVrf] = useState(false);
  const [vrfSoftTimeout, setVrfSoftTimeout] = useState(false);
  /** Visual-only landing bucket while the ball animates before VRF resolves */
  const [dropPreviewIndex, setDropPreviewIndex] = useState<number | null>(null);
  const rollSnapshotRef = useRef<bigint | null>(null);

  const isSupportedChain = (CASINO_CHAIN_IDS as readonly number[]).includes(chainId);

  const { data: receipt, isLoading: receiptLoading } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const minBetWei = minBet ?? BigInt(0);
  const vrfWei = typeof vrfCost === "bigint" ? vrfCost : undefined;

  const houseEdgeBp = useMemo(() => {
    const cfg = chainTokenConfig as readonly unknown[] | undefined;
    if (!cfg || !Array.isArray(cfg) || typeof cfg[0] !== "number") return undefined;
    return cfg[0];
  }, [chainTokenConfig]);

  const selectedConfig = useMemo(
    () => plinkoConfigs.find((c) => c.configId === selectedConfigId),
    [plinkoConfigs, selectedConfigId],
  );

  const animationBuckets = useMemo(
    () => bucketVisualsForConfig(selectedConfig, houseEdgeBp ?? 0),
    [selectedConfig, houseEdgeBp],
  );

  const resultConfig = useMemo(
    () => plinkoConfigs.find((c) => c.configId === frozenConfigId),
    [plinkoConfigs, frozenConfigId],
  );

  const resultBuckets = useMemo(
    () => bucketVisualsForConfig(resultConfig, houseEdgeBp ?? 0),
    [resultConfig, houseEdgeBp],
  );

  useEffect(() => {
    if (plinkoConfigs.length === 0) return;
    const exists = plinkoConfigs.some((c) => c.configId === selectedConfigId);
    if (!exists) {
      setSelectedConfigId(plinkoConfigs[0].configId);
    }
  }, [plinkoConfigs, selectedConfigId]);

  const parsedAmount = useMemo(() => {
    const t = amount.trim();
    const zero = BigInt(0);
    if (!t) return { ok: false as const, wei: zero };
    try {
      return { ok: true as const, wei: parseUnits(t, betToken.decimals) };
    } catch {
      return { ok: false as const, wei: zero };
    }
  }, [amount, betToken.decimals]);

  const amountError =
    amount.trim() !== "" && !parsedAmount.ok
      ? "Enter a valid number (e.g. 0.01)"
      : null;

  const belowMin =
    parsedAmount.ok &&
    minBet !== undefined &&
    parsedAmount.wei > BigInt(0) &&
    parsedAmount.wei < minBetWei;

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
    if (phase !== "dropping" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;
    if (receipt.status === "reverted") {
      setPhase("picking");
      setTxHash(undefined);
      return;
    }
    rollSnapshotRef.current = lastRoll?.id ?? null;
    setWaitingVrf(true);
    setVrfSoftTimeout(false);
  }, [phase, receipt, receiptLoading, txHash, lastRoll?.id]);

  useEffect(() => {
    if (!waitingVrf || !receipt?.blockNumber || !refreshRolls) return;
    const fromBlock = receipt.blockNumber;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void refreshRolls(fromBlock);
    };
    tick();
    const id = setInterval(tick, 5_000);
    const softId = setTimeout(() => {
      if (!cancelled) setVrfSoftTimeout(true);
    }, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(softId);
    };
  }, [waitingVrf, receipt?.blockNumber, refreshRolls]);

  useEffect(() => {
    if (!waitingVrf || !lastRoll) return;
    if (rollSnapshotRef.current !== null && lastRoll.id === rollSnapshotRef.current) return;

    const cfg = plinkoConfigs.find((c) => c.configId === lastRoll.configId);
    const idx = lastRoll.rolled[0];
    if (typeof idx !== "number" || !Number.isFinite(idx) || !cfg) {
      setOutcomeIndex(null);
      setDecodedOutcome(null);
      setWon(null);
    } else {
      setOutcomeIndex(idx);
      const he = houseEdgeBp ?? 0;
      const decoded = Plinko.decodeRolled(idx, cfg, he);
      setDecodedOutcome(decoded);
      setWon(Plinko.isSingleRolledWin(decoded));
    }
    setPayoutWei(lastRoll.payout);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
    setDropPreviewIndex(null);
    setPhase("result");
  }, [waitingVrf, lastRoll, plinkoConfigs, houseEdgeBp]);

  const canSubmit =
    isConnected &&
    canWager &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading &&
    !plinkoConfigsLoading &&
    plinkoConfigs.length > 0 &&
    selectedConfig !== undefined &&
    (phase === "idle" || phase === "picking");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || !connected) return;
      reset?.();
      setOutcomeIndex(null);
      setDecodedOutcome(null);
      setWon(null);
      setPayoutWei(null);
      setWaitingVrf(false);
      setVrfSoftTimeout(false);
      setFrozenConfigId(selectedConfigId);
      const cfgForPreview = plinkoConfigs.find((c) => c.configId === selectedConfigId);
      const he = houseEdgeBp ?? 0;
      const previewN =
        cfgForPreview && typeof he === "number"
          ? Plinko.getSortedPlinkoOutputs(cfgForPreview, he).length
          : 0;
      setDropPreviewIndex(previewN > 0 ? Math.floor(Math.random() * previewN) : 0);
      setPhase("dropping");
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

      const betData: WheelBetData = {
        token: betToken.address,
        betAmount,
        betCount: defaultCasinoGameParams.betCount,
        stopGain: defaultCasinoGameParams.stopGain,
        stopLoss: defaultCasinoGameParams.stopLoss,
        maxHouseEdge: MAX_HOUSE_EGDE,
      };

      try {
        const hash = await placeWager(selectedConfigId, connected, affiliate, betData);
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
      placeWager,
      selectedConfigId,
      parsedAmount.wei,
      vrfWei,
      plinkoConfigs,
      houseEdgeBp,
      betToken.address,
    ],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setOutcomeIndex(null);
    setDecodedOutcome(null);
    setWon(null);
    setPayoutWei(null);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
    setDropPreviewIndex(null);
    if (parsedAmount.ok && parsedAmount.wei > BigInt(0)) {
      setPhase("picking");
    } else {
      setPhase("idle");
    }
  }

  const displayBuckets = phase === "result" ? resultBuckets : animationBuckets;

  return (
    <div className="page-shell">
      <nav className="type-caption mb-6">
        <Link href="/casino" className="text-emerald-400/90 hover:text-emerald-300">
          ← Casino
        </Link>
      </nav>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 lg:mb-10">
          <h1 className="type-display">Plinko</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Drop through the pegs for a multiplier bucket. Settled on-chain with Chainlink VRF.
          </p>
        </header>

        {isConnected && !isSupportedChain ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3">
            <span className="text-sm text-amber-100">
              You&apos;re connected to an unsupported network.
            </span>
            <button
              type="button"
              onClick={() => switchChain?.({ chainId: base.id })}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-500"
            >
              Switch to Base
            </button>
          </div>
        ) : isConnected && isSupportedChain ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-zinc-300">
              {chainName(chainId)}
            </span>
          </div>
        ) : null}

        {isConnected && isSupportedChain && !canWager ? (
          <p className="type-body mb-8 max-w-xl rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-amber-100">
            Plinko is currently paused on this network. Try switching to another supported network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(30rem,100%)]">
            <PlinkoAnimation
              phase={phase}
              buckets={displayBuckets}
              landingIndex={
                phase === "dropping"
                  ? dropPreviewIndex
                  : phase === "result"
                    ? outcomeIndex
                    : null
              }
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
                      : phase === "dropping"
                        ? "bg-amber-950/80 text-amber-100 ring-1 ring-amber-700/50"
                        : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600"
                }`}
              >
                {PHASE_LABEL[phase]}
              </span>
              {phase === "dropping" ? (
                <span className="type-caption text-zinc-500">
                  {isPending
                    ? "Confirm in your wallet…"
                    : receiptLoading
                      ? "Waiting for on-chain confirmation…"
                      : waitingVrf
                        ? vrfSoftTimeout
                          ? "VRF is taking longer than usual — still waiting for the callback tx…"
                          : "Waiting for Chainlink VRF (separate callback tx)…"
                        : null}
                  {waitingVrf && txHash ? (() => {
                    const url = explorerTxUrl(chainId, txHash);
                    return url ? (
                      <>
                        {" "}
                        <a href={url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">
                          View wager tx
                        </a>
                      </>
                    ) : null;
                  })() : null}
                </span>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
            >
              <fieldset className="space-y-5" disabled={!canWager || phase === "dropping"}>
                <legend className="sr-only">Bet options</legend>

                <div>
                  <label htmlFor="plinko-config" className="type-overline mb-2 block">
                    Board layout
                  </label>
                  {!isConnected || !isSupportedChain ? (
                    <p className="type-caption text-zinc-500">
                      Connect on a supported network to load board layouts.
                    </p>
                  ) : plinkoConfigsLoading ? (
                    <p className="type-caption text-zinc-500">Loading layouts…</p>
                  ) : plinkoConfigs.length === 0 ? (
                    <p className="type-caption text-amber-300">
                      No Plinko configurations found for this network.
                    </p>
                  ) : (
                    <select
                      id="plinko-config"
                      value={selectedConfigId}
                      onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                      className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-emerald-600/0 transition focus:border-zinc-600 focus:ring-2 focus:ring-emerald-600/30"
                    >
                      {plinkoConfigs.map((c) => (
                        <option key={c.configId} value={c.configId}>
                          {c.label?.trim() || `Config ${c.configId}`} · {c.multipliers.length}{" "}
                          buckets
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedConfig && houseEdgeBp !== undefined ? (
                    <p className="type-caption mt-2 text-zinc-500">
                      House edge{" "}
                      <span className="font-mono text-zinc-400">
                        {((houseEdgeBp / BP_VALUE) * 100).toFixed(2)}%
                      </span>
                      . Bucket odds follow on-chain weights.
                    </p>
                  ) : null}
                </div>

                {availableTokens.length > 1 && (
                  <div>
                    <p className="type-overline mb-2">Token</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTokens.map((t, idx) => (
                        <button
                          key={t.address}
                          type="button"
                          onClick={() => {
                            setSelectedTokenIdx(idx);
                            setAmount("");
                            if (phase !== "idle") setPhase("idle");
                          }}
                          className={`min-h-[40px] rounded-lg border px-4 py-1.5 text-sm font-medium transition ${
                            idx === selectedTokenIdx
                              ? "border-emerald-600 bg-emerald-950/50 text-emerald-100"
                              : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
                          }`}
                        >
                          {t.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="plinko-amount" className="type-overline mb-2 block">
                    Stake ({betToken.symbol})
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {stakePresets.map((preset) => (
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
                    id="plinko-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none ring-emerald-600/0 transition focus:border-zinc-600 focus:ring-2 focus:ring-emerald-600/30"
                  />
                  {amountError ? (
                    <p className="type-caption mt-1.5 text-red-400">{amountError}</p>
                  ) : null}
                  {belowMin ? (
                    <p className="type-caption mt-1.5 text-amber-300">
                      Minimum stake is {formatUnits(minBetWei, betToken.decimals)} {betToken.symbol} (covers required fees and minimum
                      bet).
                    </p>
                  ) : null}
                  {minBetLoading ? (
                    <p className="type-caption mt-1.5 text-zinc-600">Loading minimum…</p>
                  ) : canWager && minBet !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      Minimum stake {formatUnits(minBetWei, betToken.decimals)} {betToken.symbol} · Enter an amount to continue.
                    </p>
                  ) : null}
                </div>

                {phase === "result" && decodedOutcome != null ? (
                  <div
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                    role="status"
                  >
                    <p className="type-overline mb-1">Outcome</p>
                    <p className="type-body text-zinc-100">
                      <span className="font-mono text-emerald-300">{decodedOutcome}</span>
                      {won === true ? (
                        <span className="ml-2 text-emerald-400/90">· Win</span>
                      ) : won === false ? (
                        <span className="ml-2 text-zinc-500">· No win</span>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="type-overline mb-2">Bet history</p>
                  {!isConnected ? (
                    <p className="type-caption text-zinc-500">
                      Connect your wallet on a supported network to load your bet history from the
                      chain.
                    </p>
                  ) : !isSupportedChain ? (
                    <p className="type-caption text-zinc-500">
                      Switch to a supported network to see your bet history.
                    </p>
                  ) : (
                    <>
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
                        <ul className="space-y-2" aria-label="Plinko bet history">
                          {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                            const cfg = plinkoConfigs.find((c) => c.configId === row.configId);
                            const idx = row.rolled[0];
                            let label: string;
                            if (
                              cfg &&
                              typeof idx === "number" &&
                              Number.isFinite(idx) &&
                              houseEdgeBp !== undefined
                            ) {
                              label = Plinko.decodeRolled(idx, cfg, houseEdgeBp);
                            } else {
                              label = `Bucket ${idx}`;
                            }
                            return (
                              <li
                                key={row.id.toString()}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                              >
                                <span className="font-mono text-xs font-semibold text-emerald-200">
                                  {label}
                                </span>
                                <span className="font-mono text-xs text-zinc-400">
                                  Bet {formatUnits(row.totalBetAmount, betToken.decimals)} · Payout{" "}
                                  {formatUnits(row.payout, betToken.decimals)} {betToken.symbol}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>

                <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                  <summary className="cursor-pointer select-none type-caption text-zinc-400">
                    How it works
                  </summary>
                  <div className="type-caption mt-3 space-y-3 border-t border-zinc-800/80 pt-3 text-zinc-500">
                    <ol className="list-decimal space-y-2 pl-4 text-zinc-400">
                      <li>
                        Choose a board layout and enter your payment. The contract uses part of it as
                        your bet and reserves the rest for settlement.
                      </li>
                      <li>
                        Confirm in your wallet. The drop uses verifiable on-chain randomness
                        (Chainlink VRF), which takes a few seconds to resolve.
                      </li>
                      <li>
                        The ball lands in a multiplier bucket; payouts follow the on-chain rules for
                        that bucket.
                      </li>
                    </ol>
                    {parsedAmount.ok && parsedAmount.wei > BigInt(0) && vrfWei !== undefined ? (
                      <div className="space-y-1 border-t border-zinc-800/80 pt-3">
                        <p className="text-zinc-400">VRF (randomness) breakdown</p>
                        <p>
                          Payment total:{" "}
                          <span className="font-mono text-zinc-300">
                            {formatUnits(parsedAmount.wei, betToken.decimals)} {betToken.symbol}
                          </span>
                        </p>
                        <p>
                          VRF fee:{" "}
                          <span className="font-mono text-zinc-300">{formatUnits(vrfWei, 18)}</span>
                        </p>
                        <p>
                          Bet amount:{" "}
                          <span className="font-mono text-zinc-300">
                            {formatUnits(
                              parsedAmount.wei > vrfWei ? parsedAmount.wei - vrfWei : BigInt(0),
                              betToken.decimals,
                            )} {betToken.symbol}
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
                    {isPending ? "Confirm in wallet…" : "Drop ball"}
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
