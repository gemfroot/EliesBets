"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { formatEther } from "viem";

export type PlinkoPhase = "idle" | "picking" | "dropping" | "result";

export type PlinkoBucketVisual = {
  label: string;
  color: string;
};

type PlinkoAnimationProps = {
  phase: PlinkoPhase;
  buckets: readonly PlinkoBucketVisual[];
  /** Bucket index for path animation and highlight (preview or final) */
  landingIndex?: number | null;
  won?: boolean | null;
  payoutWei?: bigint | null;
  className?: string;
};

const VIEW_W = 100;
const VIEW_H = 100;
const PEG_ROWS = 9;
const PEG_RADIUS = 1.1;
const BALL_R = 2.4;

function buildPegPositions(rows: number): { x: number; y: number }[] {
  const pegs: { x: number; y: number }[] = [];
  const y0 = 8;
  const yStep = 7.2;
  for (let r = 0; r < rows; r++) {
    const count = r + 2;
    const spread = 62;
    const left = (VIEW_W - spread) / 2;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      pegs.push({
        x: left + t * spread,
        y: y0 + r * yStep,
      });
    }
  }
  return pegs;
}

function buildDropPath(
  targetBucket: number,
  bucketCount: number,
  pegs: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (bucketCount <= 0) return [{ x: VIEW_W / 2, y: 4 }];
  const targetX = ((targetBucket + 0.5) / bucketCount) * VIEW_W;
  const start = { x: VIEW_W / 2, y: 4 };
  const points: { x: number; y: number }[] = [start];

  const rows = PEG_ROWS;
  for (let r = 0; r < rows; r++) {
    const frac = (r + 1) / (rows + 1);
    const baseX = start.x + (targetX - start.x) * frac;
    const wobble = Math.sin((r + 1) * 2.1 + targetBucket * 0.7) * 2.2;
    const rowPegs = pegs.filter((p) => Math.abs(p.y - (8 + r * 7.2)) < 0.5);
    let x = baseX + wobble;
    if (rowPegs.length > 0) {
      const nearest = rowPegs.reduce((a, b) =>
        Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a,
      );
      x = nearest.x + (x >= nearest.x ? PEG_RADIUS + 0.8 : -PEG_RADIUS - 0.8);
    }
    x = Math.min(Math.max(x, 6), VIEW_W - 6);
    points.push({ x, y: 8 + r * 7.2 + 2 });
  }

  points.push({ x: targetX, y: VIEW_H - 14 });
  return points;
}

const CONFETTI_COUNT = 20;

export function PlinkoAnimation({
  phase,
  buckets,
  landingIndex = null,
  won = null,
  payoutWei = null,
  className = "",
}: PlinkoAnimationProps) {
  const labelId = useId();
  const n = buckets.length;
  const pegs = useMemo(() => buildPegPositions(PEG_ROWS), []);

  const dropPath = useMemo(() => {
    if (landingIndex == null || n <= 0) return [];
    const clamped = Math.max(0, Math.min(n - 1, landingIndex));
    return buildDropPath(clamped, n, pegs);
  }, [landingIndex, n, pegs]);

  const pathD = useMemo(() => {
    if (dropPath.length < 2) return "";
    const [first, ...rest] = dropPath;
    let d = `M ${first.x} ${first.y}`;
    for (const p of rest) {
      d += ` L ${p.x} ${p.y}`;
    }
    return d;
  }, [dropPath]);

  const showResult = phase === "result" && landingIndex != null && n > 0;
  const outcomeHue =
    landingIndex != null && n > 0 ? (landingIndex * 67 + 31) % 360 : 200;

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
  const animatingDrop = phase === "dropping" && pathD.length > 0;

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      aria-labelledby={labelId}
    >
      <style>{`
        @keyframes plinko-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .plinko-board-idle { animation: plinko-float 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .plinko-board-idle { animation: none; }
        }
      `}</style>

      {showConfetti ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[min(24rem,90vw)] overflow-hidden motion-reduce:hidden"
          aria-hidden
        >
          {confettiStyles.map((style, i) => (
            <span key={i} className="confetti-bit" style={style} />
          ))}
        </div>
      ) : null}

      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Choose a board and stake"}
        {phase === "picking" && "Drop when ready"}
        {phase === "dropping" && "Ball dropping…"}
        {phase === "result" && (landingIndex != null ? "Result" : "Settled")}
      </p>

      <div
        className={`relative w-full max-w-[min(24rem,94vw)] ${
          phase === "idle" || phase === "picking" ? "plinko-board-idle" : ""
        }`}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full overflow-visible rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]"
          role="img"
          aria-label="Plinko board"
        >
          <defs>
            <linearGradient id={`${labelId}-peg`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
            <linearGradient id={`${labelId}-ball`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {pegs.map((p, i) => (
            <circle
              key={`peg-${i}`}
              cx={p.x}
              cy={p.y}
              r={PEG_RADIUS}
              fill={`url(#${labelId}-peg)`}
              stroke="#27272a"
              strokeWidth={0.15}
            />
          ))}

          {n > 0 ? (
            <g>
              {buckets.map((b, i) => {
                const slotW = VIEW_W / n;
                const x = i * slotW;
                return (
                  <rect
                    key={`slot-${i}`}
                    x={x + 0.15}
                    y={VIEW_H - 12}
                    width={slotW - 0.3}
                    height={10}
                    rx={0.8}
                    fill={b.color}
                    fillOpacity={landingIndex === i ? 0.95 : 0.42}
                    stroke={landingIndex === i ? "#fbbf24" : "#3f3f46"}
                    strokeWidth={landingIndex === i ? 0.35 : 0.12}
                  />
                );
              })}
            </g>
          ) : (
            <text
              x={VIEW_W / 2}
              y={VIEW_H / 2}
              textAnchor="middle"
              className="fill-zinc-500"
              style={{ fontSize: 3 }}
            >
              No board data
            </text>
          )}

          {animatingDrop ? (
            <circle r={BALL_R} fill={`url(#${labelId}-ball)`} stroke="#92400e" strokeWidth={0.2}>
              <animateMotion
                dur="2.4s"
                fill="freeze"
                calcMode="spline"
                keySplines="0.33 0.12 0.25 1"
                keyTimes="0;1"
                path={pathD}
              />
            </circle>
          ) : phase === "result" && landingIndex != null && n > 0 ? (
            <circle
              cx={((landingIndex + 0.5) / n) * VIEW_W}
              cy={VIEW_H - 7}
              r={BALL_R}
              fill={`url(#${labelId}-ball)`}
              stroke="#92400e"
              strokeWidth={0.2}
            />
          ) : (
            <circle
              cx={VIEW_W / 2}
              cy={4.5}
              r={BALL_R}
              fill={`url(#${labelId}-ball)`}
              fillOpacity={0.9}
              stroke="#92400e"
              strokeWidth={0.2}
            />
          )}
        </svg>

        {n > 0 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1 px-1">
            {buckets.map((b, i) => (
              <span
                key={`lbl-${i}`}
                className={`type-caption max-w-[4.5rem] truncate text-center text-[0.65rem] sm:text-xs ${
                  landingIndex === i ? "font-semibold text-zinc-100" : "text-zinc-500"
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {showResult && payoutWei != null ? (
        <p className="type-caption mt-4 text-zinc-400">
          Payout{" "}
          <span className="font-mono text-emerald-300/95">{formatEther(payoutWei)}</span>{" "}
          native
        </p>
      ) : null}
    </div>
  );
}
