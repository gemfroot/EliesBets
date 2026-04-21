"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  selectionId,
  useBetslipSelectionSelected,
} from "@/components/Betslip";
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { formatOddsValue } from "@/lib/oddsFormat";

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
  const { format: oddsFormat } = useOddsFormat();
  const oddsText = formatOddsValue(odds, oddsFormat);
  const unavailable =
    disabledProp || !Number.isFinite(odds) || odds <= 0 || oddsText === "—";

  const selectionKey = selectionId(gameId, outcomeName, outcomeId);
  const selected = useBetslipSelectionSelected(selectionKey);

  const prevOddsRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (unavailable) {
      prevOddsRef.current = Number.isFinite(odds) ? odds : null;
      return;
    }
    const prev = prevOddsRef.current;
    let raf = 0;
    if (prev != null && prev > 0 && odds > 0 && prev !== odds) {
      raf = window.requestAnimationFrame(() => {
        setFlash(odds > prev ? "up" : "down");
      });
    }
    prevOddsRef.current = odds;
    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [odds, unavailable]);

  useEffect(() => {
    if (!flash) {
      return;
    }
    const t = window.setTimeout(() => setFlash(null), 450);
    return () => window.clearTimeout(t);
  }, [flash]);

  const ringWhenSelected =
    !unavailable && selected
      ? "ring-2 ring-amber-500/90 ring-offset-2 ring-offset-zinc-950"
      : "";

  const idleSurface = unavailable
    ? "cursor-not-allowed bg-zinc-800/40 opacity-50"
    : "bg-zinc-800/80 hover:scale-[1.02] hover:bg-zinc-700/90 active:scale-[0.98]";

  const flashSurface =
    flash === "up"
      ? "animate-odds-flash-up"
      : flash === "down"
        ? "animate-odds-flash-down"
        : "";

  const surface =
    unavailable || !flashSurface
      ? `${idleSurface} ${!unavailable ? ringWhenSelected : ""}`
      : `${flashSurface} ${ringWhenSelected}`;

  const base =
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-md px-2 py-2 text-center transition-[background-color,box-shadow,transform] duration-300 ease-out motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 md:min-h-0";

  const oddsAriaLabel = unavailable
    ? undefined
    : `${typeof label === "string" && label.trim() ? label : outcomeName}, ${oddsText}`;

  return (
    <button
      {...rest}
      type={type}
      disabled={unavailable}
      onClick={unavailable ? undefined : onClick}
      aria-pressed={selected}
      aria-label={oddsAriaLabel}
      className={`${base} ${surface} ${className}`.trim()}
    >
      {label != null ? (
        <span className="max-w-full truncate text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
      ) : null}
      <span className="type-odds text-zinc-100">{oddsText}</span>
    </button>
  );
}
