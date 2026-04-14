"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BP_VALUE } from "@betswirl/sdk-core";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { base } from "viem/chains";
import { CoinFlipAnimation, type CoinFlipPhase } from "@/components/CoinFlipAnimation";
import { useCoinToss } from "@/lib/casino/hooks";
import { CASINO_CHAIN_IDS, getBetTokens, type BetToken } from "@/lib/casino/addresses";
import { chainName, explorerTxUrl } from "@/lib/chains";

type GamePhase = CoinFlipPhase;

const BET_HISTORY_DISPLAY_CAP = 12;

const PHASE_LABEL: Record<GamePhase, string> = {
  idle: "Ready",
  picking: "Ready to play",
  flipping: "Flipping",
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

export function CoinTossGame() {
  const { isConnected } = useAccount();
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
  } = useCoinToss(selectedToken);

  const stakePresets = STAKE_PRESETS_BY_SYMBOL[betToken.symbol] ?? DEFAULT_PRESETS;

  const [betHeads, setBetHeads] = useState(true);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [frozenBetHeads, setFrozenBetHeads] = useState(true);
  const [outcome, setOutcome] = useState<"heads" | "tails" | null>(null);
  const [payoutWei, setPayoutWei] = useState<bigint | null>(null);
  const [waitingVrf, setWaitingVrf] = useState(false);
  const [vrfSoftTimeout, setVrfSoftTimeout] = useState(false);
  const rollSnapshotRef = useRef<bigint | null>(null);

  const isSupportedChain = (CASINO_CHAIN_IDS as readonly number[]).includes(chainId);

  const fmt = useCallback(
    (wei: bigint) => formatUnits(wei, betToken.decimals),
    [betToken.decimals],
  );

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

  const winMultiplier = useMemo(() => {
    if (houseEdgeBp === undefined) return undefined;
    return (2 * (BP_VALUE - houseEdgeBp)) / BP_VALUE;
  }, [houseEdgeBp]);

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

  // Wager tx confirmed → start waiting for VRF callback
  useEffect(() => {
    if (phase !== "flipping" || !receipt || receiptLoading) return;
    if (txHash && receipt.transactionHash !== txHash) return;
    if (receipt.status === "reverted") {
      setPhase("picking");
      setTxHash(undefined);
      return;
    }
    setWaitingVrf(true);
    setVrfSoftTimeout(false);
  }, [phase, receipt, receiptLoading, txHash]);

  // Roll event arrives from VRF callback → show result
  useEffect(() => {
    if (!waitingVrf || !lastRoll) return;
    if (rollSnapshotRef.current !== null && lastRoll.id === rollSnapshotRef.current) {
      return;
    }

    const landedHeads = lastRoll.rolled[0] === true;
    setOutcome(landedHeads ? "heads" : "tails");
    setPayoutWei(lastRoll.payout);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
    setPhase("result");
  }, [waitingVrf, lastRoll]);

  // Fallback polling: if useWatchContractEvent misses the Roll event (flaky
  // RPC websockets on Base/public endpoints), poll getContractEvents since the
  // wager block so the UI always resolves once the Roll log exists on-chain.
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
      setPayoutWei(null);
      setWaitingVrf(false);
      setVrfSoftTimeout(false);
      setFrozenBetHeads(betHeads);
      // Snapshot BEFORE sending the tx so useWatchContractEvent can't race
      // ahead and capture the new Roll's id as the "baseline".
      rollSnapshotRef.current = lastRoll?.id ?? null;
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
    [canSubmit, reset, placeWager, betHeads, parsedAmount.wei, lastRoll?.id],
  );

  function onPlayAgain() {
    reset?.();
    setTxHash(undefined);
    setOutcome(null);
    setPayoutWei(null);
    setWaitingVrf(false);
    setVrfSoftTimeout(false);
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
            Pick heads or tails, choose your stake, and flip. Settled on-chain with
            Chainlink VRF.
          </p>
        </header>

        {/* Network indicator */}
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
            CoinToss is currently paused on this network. Try switching to another supported
            network.
          </p>
        ) : null}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 justify-center lg:sticky lg:top-8 lg:max-w-[min(28rem,100%)]">
            <CoinFlipAnimation
              phase={phase}
              outcome={outcome}
              betHeads={frozenBetHeads}
              payoutWei={payoutWei}
              tokenSymbol={betToken.symbol}
              tokenDecimals={betToken.decimals}
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
                {PHASE_LABEL[phase]}
              </span>
              {phase === "flipping" ? (
                <span className="type-caption text-zinc-500">
                  {isPending
                    ? "Confirm in your wallet…"
                    : receiptLoading
                      ? "Waiting for on-chain confirmation…"
                      : waitingVrf
                        ? vrfSoftTimeout
                          ? "VRF is taking longer than usual. The subscription may be out of LINK, or the callback is still pending."
                          : "Waiting for Chainlink VRF (separate callback tx)…"
                        : null}
                  {waitingVrf && txHash ? (
                    <>
                      {" "}
                      {(() => {
                        const url = explorerTxUrl(chainId, txHash);
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 underline"
                          >
                            View wager tx
                          </a>
                        ) : null;
                      })()}
                      {receipt?.blockNumber != null ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => void refreshRolls(receipt.blockNumber)}
                            className="text-emerald-400 hover:text-emerald-300 underline"
                          >
                            Check now
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
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
                  <label htmlFor="coin-toss-amount" className="type-overline mb-2 block">
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
                    id="coin-toss-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none ring-emerald-600/0 transition focus:border-zinc-600 focus:ring-2 focus:ring-emerald-600/30"
                  />
                  {parsedAmount.ok && parsedAmount.wei > BigInt(0) && vrfWei !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      VRF fee: ~{formatUnits(vrfWei, 18)} (paid in native gas token).
                    </p>
                  ) : null}
                  {amountError ? (
                    <p className="type-caption mt-1.5 text-red-400">{amountError}</p>
                  ) : null}
                  {belowMin ? (
                    <p className="type-caption mt-1.5 text-amber-300">
                      Minimum bet is {fmt(minBetWei)} {betToken.symbol}.
                    </p>
                  ) : null}
                  {minBetLoading ? (
                    <p className="type-caption mt-1.5 text-zinc-600">Loading minimum…</p>
                  ) : canWager && minBet !== undefined ? (
                    <p className="type-caption mt-1.5 text-zinc-500">
                      Minimum bet {fmt(minBetWei)} {betToken.symbol} · Enter an amount to continue.
                    </p>
                  ) : null}
                </div>

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
                        <ul
                          className="space-y-2"
                          aria-label="Coin toss bet history"
                        >
                          {betHistory.slice(0, BET_HISTORY_DISPLAY_CAP).map((row) => {
                            const landedHeads = row.rolled[0] === true;
                            return (
                              <li
                                key={row.id.toString()}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                              >
                                <span
                                  className={`font-mono text-xs font-semibold uppercase ${
                                    landedHeads ? "text-emerald-300" : "text-red-300"
                                  }`}
                                >
                                  {landedHeads ? "Heads" : "Tails"}
                                </span>
                                <span className="font-mono text-xs text-zinc-400">
                                  Bet {fmt(row.totalBetAmount)} · Payout{" "}
                                  {fmt(row.payout)} {betToken.symbol}
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
                        Choose heads or tails and enter your payment. The contract uses part of it as
                        your bet and reserves the rest for settlement.
                      </li>
                      <li>
                        Confirm in your wallet. The flip uses verifiable on-chain randomness
                        (Chainlink VRF), which takes a few seconds to resolve.
                      </li>
                      <li>
                        {houseEdgeBp !== undefined && winMultiplier !== undefined ? (
                          <>
                            On a win, payout is based on a{" "}
                            <span className="font-mono text-zinc-300">
                              ~{winMultiplier.toFixed(2)}×
                            </span>{" "}
                            multiplier on your bet amount (house edge{" "}
                            <span className="font-mono text-zinc-300">
                              {((houseEdgeBp / BP_VALUE) * 100).toFixed(2)}%
                            </span>
                            ).
                          </>
                        ) : (
                          <span className="text-zinc-600">Loading payout rules…</span>
                        )}
                      </li>
                    </ol>
                    {parsedAmount.ok && parsedAmount.wei > BigInt(0) && vrfWei !== undefined ? (
                      <div className="space-y-1 border-t border-zinc-800/80 pt-3">
                        <p className="text-zinc-400">Cost breakdown</p>
                        <p>
                          Bet amount:{" "}
                          <span className="font-mono text-zinc-300">
                            {fmt(parsedAmount.wei)} {betToken.symbol}
                          </span>
                        </p>
                        <p>
                          VRF fee (paid in native gas token):{" "}
                          <span className="font-mono text-zinc-300">
                            {formatUnits(vrfWei, 18)}
                          </span>
                        </p>
                        {!betToken.isNative && (
                          <p className="text-xs text-zinc-500">
                            An ERC-20 approve transaction will precede the bet.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="border-t border-zinc-800/80 pt-3 text-zinc-600">
                        Enter a stake above to see the cost breakdown.
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
                    {isPending
                      ? "Confirm in wallet…"
                      : !betToken.isNative
                        ? "Approve & Flip"
                        : "Flip"}
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
