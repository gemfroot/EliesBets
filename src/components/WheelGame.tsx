"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BP_VALUE,
  MAX_HOUSE_EGDE,
  Wheel,
  defaultCasinoGameParams,
  type WeightedGameConfiguration,
} from "@betswirl/sdk-core";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useConnection, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { useWalletChainId } from "@/lib/useWalletChainId";
import { base } from "viem/chains";
import { WheelAnimation, type WheelPhase } from "@/components/WheelAnimation";
import { useWheel, type WheelBetData } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS, getBetTokens, type BetToken } from "@/lib/casino/addresses";
import { chainName, explorerTxUrl } from "@/lib/chains";
import { formatWalletTxError } from "@/lib/userFacingTxError";

const BET_HISTORY_DISPLAY_CAP = 12;

const PHASE_LABEL: Record<WheelPhase, string> = {
  idle: "Ready",
  picking: "Ready to play",
  spinning: "Spinning",
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

const FALLBACK_SEGMENT_COLORS = [
  "#0d9488",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
  "#2563eb",
  "#ca8a04",
  "#16a34a",
  "#dc2626",
] as const;

function segmentVisualsForConfig(cfg: WeightedGameConfiguration | undefined) {
  if (!cfg) return [];
  const n = cfg.multipliers.length;
  return Array.from({ length: n }, (_, i) => ({
    label: `${Wheel.getFormattedMultiplier(cfg, i).toFixed(2)}×`,
    color: cfg.colors?.[i] ?? FALLBACK_SEGMENT_COLORS[i % FALLBACK_SEGMENT_COLORS.length],
  }));
}

export function WheelGame() {
  const { isConnected, address: connected } = useConnection();
  const chainId = useWalletChainId();
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
    wheelConfigs,
    wheelConfigsLoading,
  } = useWheel(selectedToken);

  const stakePresets = STAKE_PRESETS_BY_SYMBOL[betToken.symbol] ?? DEFAULT_PRESETS;

  const [selectedConfigId, setSelectedConfigId] = useState(0);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<WheelPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenConfigId, setFrozenConfigId] = useState(0);
  const [outcomeIndex, setOutcomeIndex] = useState<number | null>(null);
  const [decodedOutcome, setDecodedOutcome] = useState<string | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [payoutWei, setPayoutWei] = useState<bigint | null>(null);
  const [waitingVrf, setWaitingVrf] = useState(false);
  const [vrfSoftTimeout, setVrfSoftTimeout] = useState(false);
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
    () => wheelConfigs.find((c) => c.configId === selectedConfigId),
    [wheelConfigs, selectedConfigId],
  );

  const animationSegments = useMemo(
    () => segmentVisualsForConfig(selectedConfig),
    [selectedConfig],
  );

  const resultConfig = useMemo(
    () => wheelConfigs.find((c) => c.configId === frozenConfigId),
    [wheelConfigs, frozenConfigId],
  );

  const resultSegments = useMemo(
    () => segmentVisualsForConfig(resultConfig),
    [resultConfig],
  );

  useEffect(() => {
    if (wheelConfigs.length === 0) return;
    const exists = wheelConfigs.some((c) => c.configId === selectedConfigId);
    if (!exists) {
      setSelectedConfigId(wheelConfigs[0].configId);
    }
  }, [wheelConfigs, selectedConfigId]);

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
    if (phase !== "spinning" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;
    if (receipt.status === "reverted") {
      setPhase("picking");
      setTxHash(undefined);
      return;
    }
    setWaitingVrf(true);
    setVrfSoftTimeout(false);
  }, [phase, receipt, receiptLoading, txHash]);

  useEffect(() => {
    if (!waitingVrf || !lastRoll) return;
    if (rollSnapshotRef.current !== null && lastRoll.id === rollSnapshotRef.current) return;

    const cfg = wheelConfigs.find((c) => c.configId === lastRoll.configId);
    const idx = lastRoll.rolled[0];
    if (typeof idx !== "number" || !Number.isFinite(idx) || !cfg) {
      setOutcomeIndex(null);
      setDecodedOutcome(null);
      setWon(null);
    } else {
      setOutcomeIndex(idx);
      const he = houseEdgeBp ?? 0;
      const decoded = Wheel.decodeRolled(idx, cfg, he);
      setDecodedOutcome(decoded);
      setWon(Wheel.isSingleRolledWin(decoded));
    }
    setPayoutWei(lastRoll.payout);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
    setPhase("result");
  }, [waitingVrf, lastRoll, wheelConfigs, houseEdgeBp]);

  useEffect(() => {
    if (!waitingVrf || !receipt?.blockNumber || !refreshRolls) return;
    const fromBlock = receipt.blockNumber;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void refreshRolls(fromBlock);
    };
    tick();
    const id = setInterval(tick, 2_500);
    const softId = setTimeout(() => {
      if (!cancelled) setVrfSoftTimeout(true);
    }, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(softId);
    };
  }, [waitingVrf, receipt?.blockNumber, refreshRolls]);

  const canSubmit =
    isConnected &&
    canWager &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading &&
    !wheelConfigsLoading &&
    wheelConfigs.length > 0 &&
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
      rollSnapshotRef.current = lastRoll?.id ?? null;
      setPhase("spinning");
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
      betToken.address,
      lastRoll?.id,
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
    if (parsedAmount.ok && parsedAmount.wei > BigInt(0)) {
      setPhase("picking");
    } else {
      setPhase("idle");
    }
  }

  const displaySegments = phase === "result" ? resultSegments : animationSegments;

  return (
    <div className="page-shell">
      <nav className="type-caption mb-6">
        <Link href="/casino" className="text-emerald-400/90 hover:text-emerald-300">
          ← Casino
        </Link>
      </nav>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 lg:mb-10">
          <h1 className="type-display">Wheel</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Pick a wheel layout, set your stake, and spin for a multiplier. Settled on-chain with
            Chainlink VRF.
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
            Wheel is currently paused on this network. Try switching to another supported network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <WheelAnimation
              phase={phase}
              segments={displaySegments}
              outcomeIndex={phase === "result" ? outcomeIndex : null}
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
                      : phase === "spinning"
                        ? "bg-amber-950/80 text-amber-100 ring-1 ring-amber-700/50"
                        : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600"
                }`}
              >
                {PHASE_LABEL[phase]}
              </span>
              {phase === "spinning" ? (
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
              <fieldset className="space-y-5" disabled={!canWager || phase === "spinning"}>
                <legend className="sr-only">Bet options</legend>

                <div>
                  <label htmlFor="wheel-config" className="type-overline mb-2 block">
                    Wheel layout
                  </label>
                  {!isConnected || !isSupportedChain ? (
                    <p className="type-caption text-zinc-500">
                      Connect on a supported network to load wheel layouts.
                    </p>
                  ) : wheelConfigsLoading ? (
                    <p className="type-caption text-zinc-500">Loading layouts…</p>
                  ) : wheelConfigs.length === 0 ? (
                    <p className="type-caption text-amber-300">
                      No wheel configurations found for this network.
                    </p>
                  ) : (
                    <select
                      id="wheel-config"
                      value={selectedConfigId}
                      onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                      className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-emerald-600/0 transition focus:border-zinc-600 focus:ring-2 focus:ring-emerald-600/30"
                    >
                      {wheelConfigs.map((c) => (
                        <option key={c.configId} value={c.configId}>
                          {c.label?.trim() || `Config ${c.configId}`} · {c.multipliers.length}{" "}
                          segments
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
                      . Segment win chances follow on-chain weights.
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
                  <label htmlFor="wheel-amount" className="type-overline mb-2 block">
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
                    id="wheel-amount"
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
                        <ul className="space-y-2" aria-label="Wheel bet history">
                          {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                            const cfg = wheelConfigs.find((c) => c.configId === row.configId);
                            const idx = row.rolled[0];
                            let label: string;
                            if (
                              cfg &&
                              typeof idx === "number" &&
                              Number.isFinite(idx) &&
                              houseEdgeBp !== undefined
                            ) {
                              label = Wheel.decodeRolled(idx, cfg, houseEdgeBp);
                            } else {
                              label = `Segment ${idx}`;
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
                        Choose a wheel layout and enter your payment. The contract uses part of it as
                        your bet and reserves the rest for settlement.
                      </li>
                      <li>
                        Confirm in your wallet. The spin uses verifiable on-chain randomness
                        (Chainlink VRF), which takes a few seconds to resolve.
                      </li>
                      <li>
                        The pointer shows which multiplier segment you landed on; payouts follow the
                        on-chain rules for that segment.
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
                    {formatWalletTxError(error)}
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
                    {isPending ? "Confirm in wallet…" : "Spin"}
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
