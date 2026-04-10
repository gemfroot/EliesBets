"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { formatEther } from "viem";

export type RoulettePhase = "idle" | "picking" | "spinning" | "result";

type RouletteAnimationProps = {
  phase: RoulettePhase;
  /** Winning number 0–36 when known */
  outcomeNumber?: number | null;
  won?: boolean | null;
  payoutWei?: bigint | null;
  className?: string;
};

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function slotColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

const CONFETTI_COUNT = 28;

export function RouletteAnimation({
  phase,
  outcomeNumber = null,
  won = null,
  payoutWei = null,
  className = "",
}: RouletteAnimationProps) {
  const labelId = useId();
  const showResult = phase === "result" && outcomeNumber != null;
  const outcomeHue = outcomeNumber != null ? (outcomeNumber * 47) % 360 : 200;

  const confettiStyles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        "--cf-left": `${(i * 23 + 11) % 100}%`,
        "--cf-delay": `${(i % 9) * 0.05}s`,
        "--cf-duration": `${2 + (i % 4) * 0.15}s`,
        "--cf-rotate": `${(i * 41) % 360}deg`,
        "--cf-hue": `${(outcomeHue + i * 13) % 360}`,
      })) as CSSProperties[],
    [outcomeHue],
  );

  const showConfetti = phase === "result" && won === true;

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      aria-labelledby={labelId}
    >
      <style>{`
        @keyframes roulette-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }
        @keyframes roulette-spin-glow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .roulette-animate-idle { animation: roulette-float 3.5s ease-in-out infinite; }
        .roulette-wheel-spin {
          animation: roulette-spin-glow 1.1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .roulette-animate-idle, .roulette-wheel-spin { animation: none; }
        }
      `}</style>

      {showConfetti ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[min(24rem,88vw)] overflow-hidden motion-reduce:hidden"
          aria-hidden
        >
          {confettiStyles.map((style, i) => (
            <span key={i} className="confetti-bit" style={style} />
          ))}
        </div>
      ) : null}

      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Pick numbers and stake"}
        {phase === "picking" && "Spin when ready"}
        {phase === "spinning" && "Ball spinning…"}
        {phase === "result" && (outcomeNumber != null ? "Result" : "Settled")}
      </p>

      <div
        className={`relative flex aspect-square w-full max-w-[min(20rem,88vw)] items-center justify-center rounded-full border-4 border-zinc-700 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ${
          phase === "spinning" ? "roulette-wheel-spin" : "roulette-animate-idle"
        }`}
        aria-hidden={phase === "result" ? false : true}
      >
        <div
          className="absolute inset-[12%] rounded-full border border-zinc-600/80 bg-zinc-950/90 shadow-inner"
          style={{
            boxShadow: showResult
              ? `inset 0 0 0 2px ${
                  outcomeNumber != null && slotColor(outcomeNumber) === "green"
                    ? "rgba(16,185,129,0.5)"
                    : outcomeNumber != null && slotColor(outcomeNumber) === "red"
                      ? "rgba(248,113,113,0.45)"
                      : "rgba(161,161,170,0.4)"
                }`
              : undefined,
          }}
        />
        <div className="relative z-[1] flex h-[42%] w-[42%] items-center justify-center rounded-full bg-zinc-900 ring-2 ring-zinc-600/90">
          {showResult && outcomeNumber != null ? (
            <span
              className={`font-mono text-4xl font-bold tabular-nums sm:text-5xl ${
                slotColor(outcomeNumber) === "green"
                  ? "text-emerald-400"
                  : slotColor(outcomeNumber) === "red"
                    ? "text-red-400"
                    : "text-zinc-100"
              }`}
            >
              {outcomeNumber}
            </span>
          ) : phase === "spinning" ? (
            <span className="text-2xl font-semibold text-amber-200/90">⋯</span>
          ) : (
            <span className="type-caption text-center text-zinc-500">0–36</span>
          )}
        </div>
        {/* Decorative tick marks */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 100 100"
          aria-hidden
        >
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1="50"
              y1="8"
              x2="50"
              y2="12"
              stroke="currentColor"
              strokeWidth="0.6"
              className="text-zinc-500"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
        </svg>
      </div>

      {showResult && outcomeNumber != null ? (
        <p className="type-caption mt-4 text-center text-zinc-500">
          {slotColor(outcomeNumber) === "green"
            ? "Green"
            : slotColor(outcomeNumber) === "red"
              ? "Red"
              : "Black"}
        </p>
      ) : null}

      {phase === "result" && payoutWei != null ? (
        <p className="type-body mt-3 text-center text-zinc-300">
          Payout{" "}
          <span className="font-mono text-emerald-300/95">{formatEther(payoutWei)}</span>
        </p>
      ) : null}
    </div>
  );
}
