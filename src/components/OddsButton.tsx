"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { selectionId, useBetslip } from "@/components/Betslip";

const FLASH_MS = 450;

function formatDecimalOdds(odds: number): string {
  return Number.isFinite(odds) && odds > 0 ? odds.toFixed(2) : "—";
}

export type OddsButtonProps = {
  gameId: string;
  outcomeName: string;
  /** Raw decimal odds; invalid or non-positive shows "—" and disables interaction. */
  odds: number;
  /** When set, matches betslip id used by `addSelection` with `outcomeId`. */
  outcomeId?: string;
  /** Suspended or otherwise unavailable — gray, not interactive. */
  disabled?: boolean;
  label?: ReactNode;
  onClick?: () => void;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "disabled" | "children"
>;

export function OddsButton({
  gameId,
  outcomeName,
  odds,
  outcomeId,
  disabled: disabledProp,
  label,
  onClick,
  className = "",
  type = "button",
  ...rest
}: OddsButtonProps) {
  const { selections } = useBetslip();
  const oddsText = formatDecimalOdds(odds);
  const unavailable =
    disabledProp || !Number.isFinite(odds) || odds <= 0 || oddsText === "—";

  const selected = selections.some(
    (s) => s.id === selectionId(gameId, outcomeName, outcomeId),
  );

  const prevOddsRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (unavailable) {
      prevOddsRef.current = Number.isFinite(odds) ? odds : null;
      return;
    }
    const prev = prevOddsRef.current;
    let nextFlash: "up" | "down" | null = null;
    if (prev !== null && prev > 0 && odds > 0) {
      if (odds > prev) {
        nextFlash = "up";
      } else if (odds < prev) {
        nextFlash = "down";
      }
    }
    prevOddsRef.current = odds;
    if (!nextFlash) {
      return;
    }
    const raf = requestAnimationFrame(() => setFlash(nextFlash));
    return () => cancelAnimationFrame(raf);
  }, [odds, unavailable]);

  useEffect(() => {
    if (!flash) {
      return;
    }
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash]);

  const ringWhenSelected =
    !unavailable && selected
      ? "ring-2 ring-amber-500/90 ring-offset-2 ring-offset-zinc-950"
      : "";

  const idleSurface = unavailable
    ? "cursor-not-allowed bg-zinc-800/40 opacity-50"
    : "bg-zinc-800/80 hover:bg-zinc-700/80";

  const flashSurface =
    flash === "up"
      ? "bg-emerald-600/35"
      : flash === "down"
        ? "bg-red-600/35"
        : "";

  const surface =
    unavailable || !flashSurface
      ? `${idleSurface} ${!unavailable ? ringWhenSelected : ""}`
      : `${flashSurface} ${ringWhenSelected}`;

  const base =
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-md px-2 py-2 text-center transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 md:min-h-0";

  return (
    <button
      {...rest}
      type={type}
      disabled={unavailable}
      onClick={unavailable ? undefined : onClick}
      aria-pressed={selected}
      className={`${base} ${surface} ${className}`.trim()}
    >
      {label != null ? (
        <span className="max-w-full truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </span>
      ) : null}
      <span className="text-sm font-semibold tabular-nums text-zinc-100">
        {oddsText}
      </span>
    </button>
  );
}
