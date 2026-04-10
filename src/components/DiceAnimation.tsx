"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { formatEther } from "viem";

export type DicePhase = "idle" | "picking" | "rolling" | "result";

type DiceAnimationProps = {
  phase: DicePhase;
  /** Target cap for this bet (1–99); shown on the meter in result */
  cap?: number;
  /** Rolled value 1–100 when known */
  outcomeRoll?: number | null;
  won?: boolean | null;
  payoutWei?: bigint | null;
  className?: string;
};

const CONFETTI_COUNT = 36;

export function DiceAnimation({
  phase,
  cap = 50,
  outcomeRoll = null,
  won = null,
  payoutWei = null,
  className = "",
}: DiceAnimationProps) {
  const labelId = useId();
  const showResult = phase === "result" && outcomeRoll != null;

  const confettiStyles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        "--cf-left": `${(i * 19 + 7) % 100}%`,
        "--cf-delay": `${(i % 10) * 0.045}s`,
        "--cf-duration": `${2.2 + (i % 5) * 0.12}s`,
        "--cf-rotate": `${(i * 43) % 360}deg`,
        "--cf-hue": `${(i * 37) % 360}`,
      })) as CSSProperties[],
    [],
  );

  const showConfetti = phase === "result" && won === true;

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      aria-labelledby={labelId}
    >
      <style>{`
        @keyframes dice-wobble {
          0%, 100% { transform: rotate(-4deg) translateY(0); }
          25% { transform: rotate(5deg) translateY(-3px); }
          50% { transform: rotate(-3deg) translateY(2px); }
          75% { transform: rotate(4deg) translateY(-2px); }
        }
        @keyframes dice-spin {
          from { transform: rotateX(0deg) rotateY(0deg); }
          to { transform: rotateX(360deg) rotateY(720deg); }
        }
        .dice-animate-idle { animation: dice-wobble 3.2s ease-in-out infinite; }
        .dice-animate-roll { animation: dice-spin 0.85s linear infinite; transform-style: preserve-3d; }
        @media (prefers-reduced-motion: reduce) {
          .dice-animate-idle, .dice-animate-roll { animation: none; }
        }
      `}</style>

      {showConfetti ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[min(26rem,88vw)] overflow-hidden motion-reduce:hidden"
          aria-hidden
        >
          {confettiStyles.map((style, i) => (
            <span key={i} className="confetti-bit" style={style} />
          ))}
        </div>
      ) : null}

      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Set your cap and stake"}
        {phase === "picking" && "Roll below your number to win"}
        {phase === "rolling" && "Rolling…"}
        {phase === "result" && (outcomeRoll != null ? "Result" : "Settled")}
      </p>

      {/* 1–100 scale: you win if the rolled number is below your cap */}
      <div
        className="relative w-full max-w-[min(22rem,92vw)]"
        aria-hidden={phase === "result" ? false : true}
      >
        <div className="mb-3 flex justify-between type-caption text-zinc-500">
          <span>1</span>
          <span className="font-mono tabular-nums text-zinc-400">Cap {cap}</span>
          <span>100</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800 ring-1 ring-zinc-700/80">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-900/90 to-emerald-700/70"
            style={{ width: `${cap}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
            style={{ left: `calc(${cap}% - 1px)` }}
          />
          {showResult && outcomeRoll != null ? (
            <div
              className="absolute top-1/2 z-[1] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-zinc-200 bg-zinc-950 text-xs font-bold text-zinc-50 shadow-lg ring-2 ring-emerald-500/40"
              style={{ left: `${outcomeRoll}%` }}
            >
              {outcomeRoll}
            </div>
          ) : null}
        </div>
        <p className="type-caption mt-2 text-center text-zinc-600">
          Win if the roll is <span className="text-zinc-400">below</span> your target number.
        </p>
      </div>

      <div
        className={[
          "relative mt-8 flex aspect-square w-[min(11rem,72vw)] max-w-full items-center justify-center rounded-2xl border-2 border-zinc-600 bg-gradient-to-br from-zinc-800 via-zinc-800 to-zinc-900 shadow-[0_16px_48px_rgb(0_0_0/0.5)]",
          phase === "idle" || phase === "picking" ? "dice-animate-idle" : "",
          phase === "rolling" ? "dice-animate-roll" : "",
        ].join(" ")}
      >
        <span className="select-none text-6xl leading-none sm:text-7xl" aria-hidden>
          🎲
        </span>
      </div>

      {phase === "result" ? (
        <div className="mt-6 max-w-sm text-center" role="status" aria-live="polite">
          {outcomeRoll != null ? (
            <>
              <p className="type-title text-zinc-100">
                Rolled <span className="font-mono tabular-nums text-emerald-300">{outcomeRoll}</span>
              </p>
              {won === true ? (
                <p className="type-body mt-1 text-emerald-400/95">
                  {payoutWei != null && payoutWei > BigInt(0) ? (
                    <>
                      Won{" "}
                      <span className="font-mono tabular-nums">{formatEther(payoutWei)}</span>
                    </>
                  ) : (
                    "You won"
                  )}
                </p>
              ) : won === false ? (
                <p className="type-body mt-1 text-zinc-400">You lost</p>
              ) : null}
            </>
          ) : (
            <p className="type-body text-zinc-400">
              Transaction confirmed. Waiting for the on-chain roll…
            </p>
          )}
        </div>
      ) : (
        <p className="type-caption mt-6 max-w-xs text-center text-zinc-600">
          {phase === "rolling"
            ? "Waiting for Chainlink VRF to settle the roll."
            : "Higher numbers mean better odds but lower multipliers."}
        </p>
      )}
    </div>
  );
}
