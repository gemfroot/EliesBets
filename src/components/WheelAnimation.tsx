"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { formatEther } from "viem";

export type WheelPhase = "idle" | "picking" | "spinning" | "result";

export type WheelSegmentVisual = {
  label: string;
  color: string;
};

type WheelAnimationProps = {
  phase: WheelPhase;
  segments: readonly WheelSegmentVisual[];
  /** Winning segment index when known */
  outcomeIndex?: number | null;
  won?: boolean | null;
  payoutWei?: bigint | null;
  className?: string;
};

const CONFETTI_COUNT = 24;

export function WheelAnimation({
  phase,
  segments,
  outcomeIndex = null,
  won = null,
  payoutWei = null,
  className = "",
}: WheelAnimationProps) {
  const labelId = useId();
  const n = segments.length;
  const showResult = phase === "result" && outcomeIndex != null && n > 0;
  const outcomeHue =
    outcomeIndex != null && n > 0 ? (outcomeIndex * 67 + 31) % 360 : 200;

  const confettiStyles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        "--cf-left": `${(i * 29 + 7) % 100}%`,
        "--cf-delay": `${(i % 8) * 0.05}s`,
        "--cf-duration": `${2 + (i % 4) * 0.12}s`,
        "--cf-rotate": `${(i * 37) % 360}deg`,
        "--cf-hue": `${(outcomeHue + i * 11) % 360}`,
      })) as CSSProperties[],
    [outcomeHue],
  );

  const showConfetti = showResult && won === true;

  /** Degrees: rotate wheel so segment `outcomeIndex` center sits at top (pointer). */
  const resultRotationDeg = useMemo(() => {
    if (outcomeIndex == null || n <= 0) return 0;
    const step = 360 / n;
    return -((outcomeIndex + 0.5) * step);
  }, [outcomeIndex, n]);

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      aria-labelledby={labelId}
    >
      <style>{`
        @keyframes wheel-float {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-3px) rotate(1deg); }
        }
        @keyframes wheel-spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .wheel-animate-idle { animation: wheel-float 3.2s ease-in-out infinite; }
        .wheel-disk-spinning {
          animation: wheel-spin-fast 0.85s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wheel-animate-idle, .wheel-disk-spinning { animation: none; }
        }
      `}</style>

      {showConfetti ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[min(22rem,88vw)] overflow-hidden motion-reduce:hidden"
          aria-hidden
        >
          {confettiStyles.map((style, i) => (
            <span key={i} className="confetti-bit" style={style} />
          ))}
        </div>
      ) : null}

      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Choose a wheel and stake"}
        {phase === "picking" && "Spin when ready"}
        {phase === "spinning" && "Wheel spinning…"}
        {phase === "result" && (outcomeIndex != null ? "Result" : "Settled")}
      </p>

      <div
        className={`relative flex w-full max-w-[min(22rem,92vw)] flex-col items-center ${
          phase === "spinning" ? "" : "wheel-animate-idle"
        }`}
      >
        {/* Pointer */}
        <div
          className="relative z-20 mb-[-0.35rem] flex h-0 w-0 justify-center"
          aria-hidden
        >
          <div className="h-0 w-0 border-x-[14px] border-x-transparent border-b-[20px] border-b-emerald-400 drop-shadow-md sm:border-x-[16px] sm:border-b-[22px]" />
        </div>

        <div className="relative aspect-square w-full max-w-[min(20rem,88vw)]">
          <div
            className={`absolute inset-0 rounded-full border-4 border-zinc-700 bg-zinc-950 p-1 shadow-[inset_0_0_32px_rgba(0,0,0,0.5)] ${
              phase === "spinning" ? "wheel-disk-spinning" : ""
            }`}
            style={
              phase === "result" && outcomeIndex != null && n > 0
                ? { transform: `rotate(${resultRotationDeg}deg)` }
                : undefined
            }
          >
            {n === 0 ? (
              <div className="flex h-full items-center justify-center rounded-full bg-zinc-900/90">
                <span className="type-caption px-4 text-center text-zinc-500">
                  No wheel segments loaded
                </span>
              </div>
            ) : (
              <svg
                viewBox="-1 -1 2 2"
                className="h-full w-full rounded-full"
                role="img"
                aria-label="Prize wheel"
              >
                <defs>
                  {segments.map((s, i) => (
                    <linearGradient
                      key={`g-${i}`}
                      id={`${labelId}-seg-${i}`}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.72} />
                    </linearGradient>
                  ))}
                </defs>
                {segments.map((seg, i) => {
                  const start = (i / n) * 2 * Math.PI - Math.PI / 2;
                  const end = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
                  const x1 = Math.cos(start);
                  const y1 = Math.sin(start);
                  const x2 = Math.cos(end);
                  const y2 = Math.sin(end);
                  const large = end - start > Math.PI ? 1 : 0;
                  const d = `M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`;
                  const isWinning =
                    showResult && outcomeIndex === i && won === true;
                  const isLosing =
                    showResult && outcomeIndex === i && won === false;
                  return (
                    <path
                      key={i}
                      d={d}
                      fill={`url(#${labelId}-seg-${i})`}
                      stroke="rgba(24,24,27,0.85)"
                      strokeWidth={0.012}
                      className={
                        isWinning
                          ? "brightness-110"
                          : isLosing
                            ? "opacity-90"
                            : undefined
                      }
                    />
                  );
                })}
                {segments.map((seg, i) => {
                  const mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
                  const r = 0.62;
                  const tx = Math.cos(mid) * r;
                  const ty = Math.sin(mid) * r;
                  const rot = ((mid * 180) / Math.PI + 90) % 360;
                  return (
                    <text
                      key={`t-${i}`}
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={n > 14 ? 0.09 : n > 10 ? 0.1 : 0.11}
                      fontWeight={700}
                      fontFamily="ui-monospace, monospace"
                      transform={`rotate(${rot}, ${tx}, ${ty})`}
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}
                    >
                      {seg.label}
                    </text>
                  );
                })}
              </svg>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]"
            aria-hidden
          />
        </div>

        {showResult && outcomeIndex != null && segments[outcomeIndex] ? (
          <div className="mt-5 w-full max-w-sm text-center">
            <p className="type-body font-semibold text-zinc-100">
              Landed on{" "}
              <span className="font-mono text-emerald-300">
                {segments[outcomeIndex].label}
              </span>
            </p>
            {payoutWei != null ? (
              <p className="type-caption mt-1 text-zinc-400">
                Payout{" "}
                <span className="font-mono text-zinc-200">{formatEther(payoutWei)}</span>{" "}
                native
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
