"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BP_VALUE, Dice } from "@betswirl/sdk-core";
import { formatEther, parseEther } from "viem";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { polygonAmoy } from "viem/chains";
import { DiceAnimation, type DicePhase } from "@/components/DiceAnimation";
import { useDice } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS } from "@/lib/casino/addresses";

const STAKE_PRESET_ETH = ["0.01", "0.05", "0.1", "0.5", "1"] as const;
const BET_HISTORY_DISPLAY_CAP = 12;
const CAP_MIN = 2;
const CAP_MAX = 99;

const PHASE_LABEL: Record<DicePhase, string> = {
  idle: "Ready",
  picking: "Ready to play",
  rolling: "Rolling",
  result: "Result",
};

const CHAIN_NAMES: Record<number, string> = {
  137: "Polygon",
  80002: "Polygon Amoy",
  100: "Gnosis",
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

function rawChainRoll(rolled: readonly number[]): number | null {
  if (!rolled.length) return null;
  const v = rolled[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function DiceGame() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const {
    data: minBet,
    isMinBetPending: minBetLoading,
    vrfCost,
    chainTokenConfig,
    placeWager,
    canWager,
    isPending,
    error,
    reset,
    lastRoll,
    betHistory,
    betHistoryLoading,
    betHistoryError,
  } = useDice();

  const [cap, setCap] = useState(50);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<DicePhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenCap, setFrozenCap] = useState(50);
  const [outcomeRoll, setOutcomeRoll] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [payoutWei, setPayoutWei] = useState<bigint | null>(null);
  const [waitingVrf, setWaitingVrf] = useState(false);
  const rollSnapshotRef = useRef<number>(0);

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

  const winChancePercent = useMemo(
    () => Dice.getWinChancePercent(String(cap)),
    [cap],
  );
  const multiplierDisplay = useMemo(
    () => Dice.getFormattedMultiplier(String(cap)),
    [cap],
  );

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
    if (phase !== "rolling" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;
    if (receipt.status === "reverted") {
      setPhase("picking");
      setTxHash(undefined);
      return;
    }
    setWaitingVrf(true);
    rollSnapshotRef.current = lastRoll?.timestamp ?? 0;
  }, [phase, receipt, receiptLoading, txHash, lastRoll?.timestamp]);

  useEffect(() => {
    if (!waitingVrf || !lastRoll) return;
    if (lastRoll.timestamp <= rollSnapshotRef.current) return;

    const raw = rawChainRoll(lastRoll.rolled);
    const displayRoll = raw != null ? Dice.decodeRolled(raw) : null;
    setOutcomeRoll(displayRoll);
    if (raw != null) {
      setWon(Dice.isSingleRolledWin(Dice.decodeRolled(raw), String(frozenCap)));
    } else {
      setWon(null);
    }
    setPayoutWei(lastRoll.payout);
    setWaitingVrf(false);
    setPhase("result");
  }, [waitingVrf, lastRoll, frozenCap]);

  const canSubmit =
    isConnected &&
    canWager &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading &&
    cap >= CAP_MIN &&
    cap <= CAP_MAX &&
    (phase === "idle" || phase === "picking");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      reset?.();
      setOutcomeRoll(null);
      setWon(null);
      setPayoutWei(null);
      setWaitingVrf(false);
      setFrozenCap(cap);
      setPhase("rolling");
      setTxHash(undefined);
      try {
        const hash = await placeWager(cap, parsedAmount.wei);
        setTxHash(hash);
      } catch {
        setPhase("picking");
        setTxHash(undefined);
      }
    },
    [canSubmit, reset, placeWager, cap, parsedAmount.wei],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setOutcomeRoll(null);
    setWon(null);
    setPayoutWei(null);
    setWaitingVrf(false);
    if (parsedAmount.ok && parsedAmount.wei > BigInt(0)) {
      setPhase("picking");
    } else {
      setPhase("idle");
    }
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
          <h1 className="type-display">Dice</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Pick a cap from {CAP_MIN}–{CAP_MAX}, stake native currency, and roll. You win if the
            result is above your cap—higher caps mean better odds and lower multipliers. Settled
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
            Dice is currently paused on this network. Try switching to another supported network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <DiceAnimation
              phase={phase}
              cap={phase === "rolling" || phase === "result" ? frozenCap : cap}
              outcomeRoll={outcomeRoll}
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
                      : phase === "rolling"
                        ? "bg-amber-950/80 text-amber-100 ring-1 ring-amber-700/50"
                        : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600"
                }`}
              >
                {PHASE_LABEL[phase]}
              </span>
              {phase === "rolling" ? (
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
              <fieldset className="space-y-5" disabled={!canWager || phase === "rolling"}>
                <legend className="sr-only">Bet options</legend>

                <div>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <p className="type-overline">Cap (roll must be &gt; cap to win)</p>
                    <span className="font-mono text-sm font-semibold tabular-nums text-zinc-200">
                      {cap}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={CAP_MIN}
                    max={CAP_MAX}
                    value={cap}
                    onChange={(e) => setCap(Number(e.target.value))}
                    className="dice-cap-slider h-3 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                    aria-valuemin={CAP_MIN}
                    aria-valuemax={CAP_MAX}
                    aria-valuenow={cap}
                    aria-label="Dice cap"
                  />
                  <div className="mt-1 flex justify-between type-caption text-zinc-600">
                    <span>{CAP_MIN}</span>
                    <span>{CAP_MAX}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                      <p className="type-caption text-zinc-500">Win chance</p>
                      <p className="type-odds text-emerald-300/95">{winChancePercent.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                      <p className="type-caption text-zinc-500">Multiplier</p>
                      <p className="type-odds text-zinc-100">{multiplierDisplay.toFixed(3)}×</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="dice-amount" className="type-overline mb-2 block">
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
                    id="dice-amount"
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
                      <ul className="space-y-2" aria-label="Dice bet history">
                        {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                          const raw = rawChainRoll(row.rolled);
                          const rolled = raw != null ? Dice.decodeRolled(raw) : null;
                          const win =
                            raw != null
                              ? Dice.isSingleRolledWin(Dice.decodeRolled(raw), String(row.cap))
                              : null;
                          return (
                            <li
                              key={row.id.toString()}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                            >
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-mono text-xs text-zinc-400">
                                  Cap {row.cap}
                                </span>
                                {rolled != null ? (
                                  <span
                                    className={`font-mono text-xs font-semibold uppercase ${
                                      win ? "text-emerald-300" : "text-red-300"
                                    }`}
                                  >
                                    Roll {rolled}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-zinc-500">—</span>
                                )}
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
                        Set your cap ({CAP_MIN}–{CAP_MAX}) and stake. The contract uses part of
                        your payment for the bet and reserves the rest for VRF and settlement.
                      </li>
                      <li>
                        Confirm in your wallet. The roll uses Chainlink VRF and resolves in a few
                        seconds.
                      </li>
                      <li>
                        {houseEdgeBp !== undefined ? (
                          <>
                            Payouts use the protocol dice odds at a house edge of{" "}
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
                    {isPending ? "Confirm in wallet…" : "Roll"}
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
