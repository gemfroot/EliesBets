"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useConnection, useWaitForTransactionReceipt } from "wagmi";
import { CoinFlipAnimation, type CoinFlipPhase } from "@/components/CoinFlipAnimation";
import { coinTossAbi } from "@/lib/casino/abis/CoinToss";
import { useCoinToss } from "@/lib/casino/hooks";

type GamePhase = CoinFlipPhase;

export function CoinTossGame() {
  const { isConnected } = useConnection();
  const {
    data: minBet,
    isMinBetPending: minBetLoading,
    placeWager,
    canWager,
    isPending,
    error,
    reset,
  } = useCoinToss();

  const [betHeads, setBetHeads] = useState(true);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenBetHeads, setFrozenBetHeads] = useState(true);
  const [outcome, setOutcome] = useState<"heads" | "tails" | null>(null);

  const { data: receipt, isLoading: receiptLoading } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash),
    },
  });

  const minBetWei = minBet ?? BigInt(0);

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
    }
  }, [isConnected, phase]);

  useEffect(() => {
    if (phase !== "flipping" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;

    try {
      const logs = parseEventLogs({
        abi: coinTossAbi,
        eventName: "Roll",
        logs: receipt.logs,
      });
      const last = logs[logs.length - 1];
      if (last && "args" in last && last.args && typeof last.args === "object") {
        const args = last.args as { rolled?: boolean[] };
        const landedHeads = args.rolled?.[0] === true;
        if (typeof landedHeads === "boolean") {
          setOutcome(landedHeads ? "heads" : "tails");
        } else {
          setOutcome(null);
        }
      } else {
        setOutcome(null);
      }
    } catch {
      setOutcome(null);
    }
    setPhase("result");
  }, [phase, receipt, receiptLoading, frozenBetHeads, txHash]);

  const canSubmit =
    isConnected &&
    canWager &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading &&
    (phase === "idle" || phase === "picking");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      reset?.();
      setOutcome(null);
      setFrozenBetHeads(betHeads);
      setPhase("flipping");
      setTxHash(undefined);
      try {
        const hash = await placeWager(betHeads, parsedAmount.wei);
        setTxHash(hash);
      } catch {
        setPhase("picking");
        setTxHash(undefined);
      }
    },
    [canSubmit, reset, placeWager, betHeads, parsedAmount.wei],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setOutcome(null);
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
          <h1 className="type-display">Coin toss</h1>
          <p className="type-muted mt-1 max-w-2xl">
            Pick a side, stake native POL (includes the Chainlink VRF fee). Connect your wallet
            on Polygon (BetSwirl defaults) or Gnosis when configured.
          </p>
        </header>

        {!canWager ? (
          <p className="type-body mb-8 max-w-xl rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-amber-100">
            Coin toss is not configured for this network. Switch to Polygon or Gnosis when
            addresses are set, or try again later.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <CoinFlipAnimation
              phase={phase}
              outcome={outcome}
              betHeads={frozenBetHeads}
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
                      : phase === "flipping"
                        ? "bg-amber-950/80 text-amber-100 ring-1 ring-amber-700/50"
                        : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600"
                }`}
              >
                {phase}
              </span>
              {phase === "flipping" ? (
                <span className="type-caption text-zinc-500">
                  {isPending
                    ? "Confirm in your wallet…"
                    : receiptLoading
                      ? "Waiting for confirmation…"
                      : null}
                </span>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
            >
              <fieldset className="space-y-5" disabled={!canWager || phase === "flipping"}>
                <legend className="sr-only">Bet options</legend>

                <div>
                  <p className="type-overline mb-2">Side</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBetHeads(true);
                        if (parsedAmount.ok && parsedAmount.wei > BigInt(0))
                          setPhase("picking");
                      }}
                      className={`min-h-[44px] flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition sm:flex-none ${
                        betHeads
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-100"
                          : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      Heads
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBetHeads(false);
                        if (parsedAmount.ok && parsedAmount.wei > BigInt(0))
                          setPhase("picking");
                      }}
                      className={`min-h-[44px] flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition sm:flex-none ${
                        !betHeads
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-100"
                          : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      Tails
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="coin-toss-amount" className="type-overline mb-2 block">
                    Stake (native)
                  </label>
                  <input
                    id="coin-toss-amount"
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
                      Minimum bet is {formatEther(minBetWei)} (native).
                    </p>
                  ) : null}
                  {minBetLoading ? (
                    <p className="type-caption mt-1.5 text-zinc-600">Loading minimum…</p>
                  ) : canWager && minBet !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      Min. {formatEther(minBetWei)} · Enter a stake to move from idle to
                      picking.
                    </p>
                  ) : null}
                </div>

                {!isConnected ? (
                  <p className="type-body text-zinc-400">
                    Connect a wallet in the header to place a bet.
                  </p>
                ) : null}

                {error ? (
                  <p className="type-body text-red-400" role="alert">
                    {error.message || "Transaction failed."}
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
                    {isPending ? "Confirm in wallet…" : "Flip"}
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
