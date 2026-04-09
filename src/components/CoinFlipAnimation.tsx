"use client";

import { useId } from "react";

export type CoinFlipPhase = "idle" | "picking" | "flipping" | "result";

type CoinFlipAnimationProps = {
  phase: CoinFlipPhase;
  /** Landed face after a flip; omit or null when unknown */
  outcome?: "heads" | "tails" | null;
  /** Whether the player bet on heads (for result summary) */
  betHeads?: boolean;
  className?: string;
};

export function CoinFlipAnimation({
  phase,
  outcome = null,
  betHeads = true,
  className = "",
}: CoinFlipAnimationProps) {
  const labelId = useId();
  const showFace = phase === "result" && outcome != null;
  const landedHeads = outcome === "heads";
  const won =
    showFace && outcome != null
      ? (betHeads && landedHeads) || (!betHeads && !landedHeads)
      : null;

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      aria-labelledby={labelId}
    >
      <p id={labelId} className="type-overline mb-4 text-center">
        {phase === "idle" && "Ready when you are"}
        {phase === "picking" && "Pick your side"}
        {phase === "flipping" && "Flipping…"}
        {phase === "result" && (outcome ? "Result" : "Settled")}
      </p>

      <div
        className={[
          "relative aspect-square w-[min(18rem,85vw)] max-w-full [perspective:1200px]",
          phase === "idle" || phase === "picking" ? "motion-safe:animate-coin-float" : "",
        ].join(" ")}
        aria-hidden={phase === "result" ? false : true}
      >
        <div
          className={[
            "relative h-full w-full [transform-style:preserve-3d]",
            phase === "flipping" ? "animate-coin-flip" : "",
            phase === "result" && outcome != null
              ? landedHeads
                ? "[transform:rotateY(0deg)]"
                : "[transform:rotateY(180deg)]"
              : "",
          ].join(" ")}
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-amber-600/80 bg-gradient-to-br from-amber-200 via-amber-100 to-amber-300 text-amber-950 shadow-[inset_0_2px_6px_rgb(255_255_255/0.5),0_12px_40px_rgb(0_0_0/0.45)] [backface-visibility:hidden] [transform:rotateY(0deg)]"
          >
            <span className="select-none text-4xl font-bold tracking-tight sm:text-5xl">
              H
            </span>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-zinc-500 bg-gradient-to-br from-zinc-600 via-zinc-500 to-zinc-700 text-zinc-50 shadow-[inset_0_2px_6px_rgb(255_255_255/0.15),0_12px_40px_rgb(0_0_0/0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <span className="select-none text-4xl font-bold tracking-tight sm:text-5xl">
              T
            </span>
          </div>
        </div>
        {/* rim highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10"
          aria-hidden
        />
      </div>

      {phase === "result" ? (
        <div
          className="mt-6 max-w-sm text-center"
          role="status"
          aria-live="polite"
        >
          {outcome ? (
            <>
              <p className="type-title capitalize text-zinc-100">{outcome}</p>
              {won === true ? (
                <p className="type-body mt-1 text-emerald-400/95">You won this round.</p>
              ) : won === false ? (
                <p className="type-body mt-1 text-zinc-400">You did not win this round.</p>
              ) : null}
            </>
          ) : (
            <p className="type-body text-zinc-400">
              Transaction confirmed. Outcome is not shown on-chain in this build; check
              your balance for the result.
            </p>
          )}
        </div>
      ) : (
        <p className="type-caption mt-6 max-w-xs text-center text-zinc-600">
          {phase === "flipping"
            ? "Waiting for the network to settle the flip."
            : "Stake native currency on heads or tails."}
        </p>
      )}
    </div>
  );
}
