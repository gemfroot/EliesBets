"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BP_VALUE,
  MAX_HOUSE_EGDE,
  Roulette,
  ROULETTE_INPUT_BUNDLE,
  defaultCasinoGameParams,
  type RouletteNumber,
} from "@betswirl/sdk-core";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useConnection, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { useWalletChainId } from "@/lib/useWalletChainId";
import { polygon } from "viem/chains";
import { RouletteAnimation, type RoulettePhase } from "@/components/RouletteAnimation";
import { useRoulette, type RouletteBetData } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS, getBetTokens, type BetToken } from "@/lib/casino/addresses";
import { chainName, explorerTxUrl } from "@/lib/chains";
import { formatWalletTxError } from "@/lib/userFacingTxError";
import { CasinoBankBanner } from "@/components/CasinoBankBanner";

const BET_HISTORY_DISPLAY_CAP = 12;

/** Table layout: top row = high third, middle = middle, bottom = low third; 0 sits above. */
const ROW_TOP = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36] as const;
const ROW_MID = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35] as const;
const ROW_BOT = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34] as const;

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function cellTone(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

const PHASE_LABEL: Record<RoulettePhase, string> = {
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

const PRESET_ORDER: readonly ROULETTE_INPUT_BUNDLE[] = [
  ROULETTE_INPUT_BUNDLE.RED,
  ROULETTE_INPUT_BUNDLE.BLACK,
  ROULETTE_INPUT_BUNDLE.ODD,
  ROULETTE_INPUT_BUNDLE.EVEN,
  ROULETTE_INPUT_BUNDLE.ONE_TO_EIGHTEEN,
  ROULETTE_INPUT_BUNDLE.EIGHTEEN_TO_THIRTY_SIX,
  ROULETTE_INPUT_BUNDLE.ONE_TO_TWELVE,
  ROULETTE_INPUT_BUNDLE.THIRTEEN_TO_TWENTY_FOUR,
  ROULETTE_INPUT_BUNDLE.TWENTY_FIVE_TO_THIRTY_SIX,
  ROULETTE_INPUT_BUNDLE.FIRST_ROW,
  ROULETTE_INPUT_BUNDLE.SECOND_ROW,
  ROULETTE_INPUT_BUNDLE.THIRD_ROW,
];

export function RouletteGame() {
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
  } = useRoulette(selectedToken);

  const stakePresets = STAKE_PRESETS_BY_SYMBOL[betToken.symbol] ?? DEFAULT_PRESETS;

  const [selected, setSelected] = useState<RouletteNumber[]>([]);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<RoulettePhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenEncoded, setFrozenEncoded] = useState<number>(0);
  const [outcomeNumber, setOutcomeNumber] = useState<number | null>(null);
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

  const presetById = useMemo(() => {
    const m = new Map<ROULETTE_INPUT_BUNDLE, RouletteNumber[]>();
    for (const c of Roulette.getChoiceInputs()) {
      if (typeof c.id !== "string") continue;
      const id = c.id as ROULETTE_INPUT_BUNDLE;
      if (!PRESET_ORDER.includes(id)) continue;
      m.set(id, c.value);
    }
    return m;
  }, []);

  const winChancePercent = useMemo(() => {
    if (selected.length === 0) return null;
    return Roulette.getWinChancePercent(selected);
  }, [selected]);

  const multiplierDisplay = useMemo(() => {
    if (selected.length === 0) return null;
    return Roulette.getFormattedMultiplier(selected);
  }, [selected]);

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

  const gridDisabled = !canWager || phase === "spinning";

  const toggleNumber = useCallback((n: RouletteNumber) => {
    if (gridDisabled) return;
    setSelected((prev) => {
      const set = new Set(prev);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      return [...set].sort((a, b) => a - b) as RouletteNumber[];
    });
  }, [gridDisabled]);

  const applyPreset = useCallback(
    (id: ROULETTE_INPUT_BUNDLE) => {
      if (gridDisabled) return;
      const nums = presetById.get(id);
      if (!nums) return;
      setSelected([...nums].sort((a, b) => a - b) as RouletteNumber[]);
      if (parsedAmount.ok && parsedAmount.wei > BigInt(0)) setPhase("picking");
    },
    [gridDisabled, presetById, parsedAmount.ok, parsedAmount.wei],
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

    const raw = lastRoll.rolled[0];
    const decoded =
      typeof raw === "number" && Number.isFinite(raw) ? Roulette.decodeRolled(raw) : null;
    setOutcomeNumber(decoded);
    if (decoded != null) {
      setWon(Roulette.isSingleRolledWin(decoded, frozenEncoded));
    } else {
      setWon(null);
    }
    setPayoutWei(lastRoll.payout);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
    setPhase("result");
  }, [waitingVrf, lastRoll, frozenEncoded]);

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
    selected.length > 0 &&
    (phase === "idle" || phase === "picking");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || !connected) return;
      reset?.();
      setOutcomeNumber(null);
      setWon(null);
      setPayoutWei(null);
      setWaitingVrf(false);
      setVrfSoftTimeout(false);
      const encoded = Roulette.encodeInput(selected);
      setFrozenEncoded(encoded);
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

      const betData: RouletteBetData = {
        token: betToken.address,
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
      betToken.address,
      lastRoll?.id,
    ],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setOutcomeNumber(null);
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

  function renderCell(n: RouletteNumber) {
    const on = selected.includes(n);
    const tone = cellTone(n);
    const base =
      tone === "green"
        ? "border-emerald-700/60 bg-emerald-900/50 text-emerald-100"
        : tone === "red"
          ? "border-red-800/70 bg-red-950/55 text-red-100"
          : "border-zinc-700 bg-zinc-900/80 text-zinc-200";
    const sel = on ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950" : "";
    return (
      <button
        key={n}
        type="button"
        disabled={gridDisabled}
        aria-pressed={on}
        onClick={() => toggleNumber(n)}
        className={`flex min-h-[36px] min-w-0 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition hover:brightness-110 disabled:opacity-50 sm:min-h-[40px] sm:text-sm ${base} ${sel}`}
      >
        {n}
      </button>
    );
  }

  return (
    <div className="page-shell">
      <nav className="type-caption mb-6">
        <Link href="/casino" className="text-emerald-400/90 hover:text-emerald-300">
          ← Casino
        </Link>
      </nav>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 lg:mb-10">
          <h1 className="type-display">Roulette</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Pick one or more numbers (or a preset), set your stake, and spin. Settled on-chain with
            Chainlink VRF.
          </p>
        </header>

        <div className="mb-6">
          <CasinoBankBanner chainId={chainId} betToken={selectedToken} game="roulette" />
        </div>

        {isConnected && !isSupportedChain ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3">
            <span className="text-sm text-amber-100">
              You&apos;re connected to an unsupported network.
            </span>
            <button
              type="button"
              onClick={() => switchChain?.({ chainId: polygon.id })}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-500"
            >
              Switch to Polygon
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
            Roulette is currently paused on this network. Try switching to another supported
            network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <RouletteAnimation
              phase={phase}
              outcomeNumber={outcomeNumber}
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
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <p className="type-overline">Numbers</p>
                    <span className="type-caption text-zinc-500">
                      {selected.length} picked
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        disabled={gridDisabled}
                        aria-pressed={selected.includes(0)}
                        onClick={() => toggleNumber(0)}
                        className={`col-span-12 flex min-h-[40px] items-center justify-center rounded-md border font-mono text-sm font-semibold transition hover:brightness-110 disabled:opacity-50 ${
                          selected.includes(0)
                            ? "border-emerald-500 bg-emerald-950/60 text-emerald-100 ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950"
                            : "border-emerald-700/70 bg-emerald-950/40 text-emerald-200"
                        }`}
                      >
                        0
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                      {ROW_TOP.map((n) => renderCell(n))}
                    </div>
                    <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                      {ROW_MID.map((n) => renderCell(n))}
                    </div>
                    <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                      {ROW_BOT.map((n) => renderCell(n))}
                    </div>
                  </div>
                  <p className="type-caption mt-2 text-zinc-600">
                    Tap a number to add or remove it from your bet.
                  </p>
                </div>

                <div>
                  <p className="type-overline mb-2">Presets</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        disabled={gridDisabled}
                        onClick={() => applyPreset(id)}
                        className="min-h-[40px] rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-left text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50 sm:px-3"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="type-caption text-zinc-500">Win chance</p>
                    <p className="type-odds text-emerald-300/95">
                      {winChancePercent != null ? `${winChancePercent.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="type-caption text-zinc-500">Multiplier</p>
                    <p className="type-odds text-zinc-100">
                      {multiplierDisplay != null ? `${multiplierDisplay.toFixed(3)}×` : "—"}
                    </p>
                  </div>
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
                  <label htmlFor="roulette-amount" className="type-overline mb-2 block">
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
                    id="roulette-amount"
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
                      <ul className="space-y-2" aria-label="Roulette bet history">
                        {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                          const rolledRaw = row.rolled[0];
                          const landed =
                            typeof rolledRaw === "number"
                              ? Roulette.decodeRolled(rolledRaw)
                              : null;
                          const win =
                            landed != null
                              ? Roulette.isSingleRolledWin(landed, Number(row.numbers))
                              : null;
                          return (
                            <li
                              key={row.id.toString()}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                            >
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {landed != null ? (
                                  <span
                                    className={`font-mono text-xs font-semibold ${
                                      win ? "text-emerald-300" : "text-red-300"
                                    }`}
                                  >
                                    {landed}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-zinc-500">—</span>
                                )}
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
                  </div>
                ) : null}

                <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                  <summary className="cursor-pointer select-none type-caption text-zinc-400">
                    How it works
                  </summary>
                  <div className="type-caption mt-3 space-y-3 border-t border-zinc-800/80 pt-3 text-zinc-500">
                    <ol className="list-decimal space-y-2 pl-4 text-zinc-400">
                      <li>
                        Choose numbers on the grid or tap a preset (red/black, columns, dozens, etc.).
                        Your win chance and multiplier update with your selection.
                      </li>
                      <li>
                        Confirm in your wallet. The spin uses Chainlink VRF and resolves in a few
                        seconds.
                      </li>
                      <li>
                        {houseEdgeBp !== undefined ? (
                          <>
                            Payouts use the protocol roulette odds at a house edge of{" "}
                            <span className="font-mono text-zinc-300">
                              {((houseEdgeBp / BP_VALUE) * 100).toFixed(2)}%
                            </span>
                            . The multiplier shown is before that edge is applied at settlement.
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
