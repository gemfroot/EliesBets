"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEther, parseEther } from "viem";
import { useConnection } from "wagmi";
import { useCoinTossMinBet, useCoinTossPlay } from "@/lib/casino/hooks";

export function CoinTossGame() {
  const { isConnected } = useConnection();
  const { data: minBet, isPending: minBetLoading } = useCoinTossMinBet();
  const { play, canPlay, isPending, error, reset } = useCoinTossPlay();
  const [betHeads, setBetHeads] = useState(true);
  const [amount, setAmount] = useState("");

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

  const canSubmit =
    isConnected &&
    canPlay &&
    parsedAmount.ok &&
    parsedAmount.wei > BigInt(0) &&
    !belowMin &&
    !isPending &&
    !minBetLoading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    reset?.();
    await play(betHeads, parsedAmount.wei);
  }

  return (
    <div className="page-shell">
      <nav className="type-caption mb-6">
        <Link href="/casino" className="text-emerald-400/90 hover:text-emerald-300">
          ← Casino
        </Link>
      </nav>

      <h1 className="type-display">Coin toss</h1>
      <p className="type-muted mt-1 max-w-xl">
        Pick a side and stake native currency. The contract uses your message value
        as the bet; minimum bet applies per chain.
      </p>

      {!canPlay ? (
        <p className="type-body mt-6 max-w-xl rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-amber-100">
          Coin toss is not configured for this network. Switch to Polygon or Gnosis
          when addresses are set, or try again later.
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
      >
        <fieldset className="space-y-5" disabled={!canPlay}>
          <legend className="sr-only">Bet options</legend>

          <div>
            <p className="type-overline mb-2">Side</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBetHeads(true)}
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
                onClick={() => setBetHeads(false)}
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
            ) : canPlay && minBet !== undefined ? (
              <p className="type-caption mt-1.5 text-zinc-500">
                Min. {formatEther(minBetWei)} · Connect your wallet to play.
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full min-h-[48px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Confirm in wallet…" : "Play"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
