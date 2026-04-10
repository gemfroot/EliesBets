"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { formatEther } from "viem";

export type KenoPhase = "idle" | "picking" | "drawing" | "result";

type KenoAnimationProps = {
  phase: KenoPhase;
  /** Decoded draw (1–N), in draw order */
  drawnBalls?: readonly number[] | null;
  /** How many drawn balls to show (for staggered reveal) */
  revealCount?: number;
  won?: boolean | null;
  payoutWei?: bigint | null;
  className?: string;
};

const CONFETTI_COUNT = 26;

export function KenoAnimation({
  phase,
  drawnBalls = null,
  revealCount = 0,
  won = null,
  payoutWei = null,
  className = "",
}: KenoAnimationProps) {
  const labelId = useId();
  const visibleDraw = useMemo(() => {
    if (!drawnBalls?.length) return [];
    return drawnBalls.slice(0, Math.min(revealCount, drawnBalls.length));
  }, [drawnBalls, revealCount]);

  const confettiStyles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        "--cf-left": `${(i * 17 + 9) % 100}%`,
        "--cf-delay": `${(i % 8) * 0.055}s`,
        "--cf-duration": `${2.1 + (i % 5) * 0.11}s`,
        "--cf-rotate": `${(i * 39) % 360}deg`,
        "--cf-hue": `${(i * 41) % 360}`,
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
        @keyframes keno-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes keno-pop {
          0% { transform: scale(0.85); opacity: 0.5; }
          55% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .keno-animate-panel { animation: keno-float 3.2s ease-in-out infinite; }
        .keno-ball-chip { animation: keno-pop 0.45s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .keno-animate-panel, .keno-ball-chip { animation: none; }
        }
      `}</style>

      {showConfetti ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[min(18rem,70vw)] overflow-hidden motion-reduce:hidden"
          aria-hidden
        >
          {confettiStyles.map((style, i) => (
            <span key={i} className="confetti-bit" style={style} />
          ))}
        </div>
      ) : null}

      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Pick numbers and stake"}
        {phase === "picking" && "Place your bet when ready"}
        {phase === "drawing" && "Drawing…"}
        {phase === "result" && "Result"}
      </p>

      <div
        className={`relative w-full max-w-[min(24rem,92vw)] rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-4 shadow-[inset_0_0_32px_rgba(0,0,0,0.35)] sm:p-5 ${
          phase === "drawing" ? "keno-animate-panel" : ""
        }`}
      >
        <p className="type-caption mb-3 text-center text-zinc-500">Live draw</p>
        {visibleDraw.length === 0 ? (
          <div className="flex min-h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-6 text-center">
            <p className="type-caption text-zinc-600">
              {phase === "drawing" ? "Waiting for balls…" : "Numbers appear here as they are drawn."}
            </p>
          </div>
        ) : (
          <ul
            className="flex flex-wrap justify-center gap-2"
            aria-label="Drawn numbers"
          >
            {visibleDraw.map((n, i) => (
              <li
                key={`${n}-${i}`}
                className="keno-ball-chip flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-amber-500/70 bg-gradient-to-b from-amber-400/25 to-amber-700/20 px-3 font-mono text-sm font-bold tabular-nums text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.25)] sm:h-12 sm:min-w-[3rem] sm:text-base"
              >
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 w-full max-w-[min(24rem,92vw)] rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center">
        {phase === "result" && payoutWei != null ? (
          <>
            <p className="type-caption text-zinc-500">Payout</p>
            <p className="type-odds font-mono text-zinc-100">{formatEther(payoutWei)}</p>
          </>
        ) : (
          <p className="type-caption text-zinc-600">
            {phase === "drawing"
              ? "Chainlink VRF is selecting the draw…"
              : "Your draw will appear above."}
          </p>
        )}
      </div>
    </div>
  );
}
