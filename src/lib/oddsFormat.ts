export type OddsFormat = "decimal" | "fractional" | "american";

export const ODDS_FORMAT_STORAGE_KEY = "eliesbets:oddsFormat";

const FORMATS: readonly OddsFormat[] = ["decimal", "fractional", "american"];

export function isOddsFormat(value: unknown): value is OddsFormat {
  return typeof value === "string" && FORMATS.includes(value as OddsFormat);
}

export function parseOddsFormat(raw: string | null): OddsFormat {
  const t = raw?.trim();
  if (t != null && isOddsFormat(t)) {
    return t;
  }
  return "american";
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Best rational approximation of `profit` with denominator ≤ maxDen.
 * Tie-break: lower error first, then smaller denominator (avoids 3959/100 when 40/1 is fine).
 */
function profitToSimplifiedFraction(
  profit: number,
  maxDen: number,
): [number, number] {
  if (!Number.isFinite(profit) || profit <= 0) {
    return [0, 1];
  }
  let bestN = 1;
  let bestD = 1;
  let bestErr = Infinity;
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(profit * den);
    if (num <= 0) {
      continue;
    }
    const err = Math.abs(num / den - profit);
    if (
      err < bestErr - 1e-9 ||
      (Math.abs(err - bestErr) < 1e-9 && den < bestD)
    ) {
      bestErr = err;
      bestN = num;
      bestD = den;
    }
  }
  const g = gcd(bestN, bestD);
  return [bestN / g, bestD / g];
}

/**
 * Fractional mode must never fall back to decimal on a per-outcome basis (that mixed
 * "3/23" with "5.44" in the same row). Use coarser rationals or simple X/1 · 1/X instead.
 */
function formatFractionalFromDecimal(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    return "—";
  }
  const profit = decimal - 1;
  if (profit <= 0) {
    return "—";
  }

  let [n, d] = profitToSimplifiedFraction(profit, 24);
  if (n <= 0 || d <= 0) {
    return "—";
  }

  if (n > 100 || d > 50) {
    [n, d] = profitToSimplifiedFraction(profit, 8);
  }
  if (n > 100 || d > 50) {
    if (profit >= 1) {
      return `${Math.max(1, Math.round(profit))}/1`;
    }
    const inv = Math.round(1 / profit);
    return `1/${Math.max(2, inv)}`;
  }

  return `${n}/${d}`;
}

function formatAmericanFromDecimal(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    return "—";
  }
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  }
  return `${Math.round(-100 / (decimal - 1))}`;
}

/** Format decimal odds (European) for display. */
export function formatDecimalOddsValue(decimal: number): string {
  return Number.isFinite(decimal) && decimal > 0 ? decimal.toFixed(2) : "—";
}

/**
 * Format a positive decimal price (e.g. 2.75) for the selected odds style.
 */
export function formatOddsValue(decimal: number, format: OddsFormat): string {
  if (!Number.isFinite(decimal) || decimal <= 0) {
    return "—";
  }
  switch (format) {
    case "decimal":
      return formatDecimalOddsValue(decimal);
    case "fractional":
      return formatFractionalFromDecimal(decimal);
    case "american":
      return formatAmericanFromDecimal(decimal);
    default:
      return formatDecimalOddsValue(decimal);
  }
}

/** Slip odds are stored as a decimal string (e.g. "2.10"); used to detect line moves vs live prices. */
export function parseStoredDecimalOdds(stored: string): number | null {
  const trimmed = stored.trim();
  if (trimmed === "" || trimmed === "—") {
    return null;
  }
  const n = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const DRIFT_COMPARE_SCALE = 1e6;

/**
 * True when the live decimal price differs from the slip’s stored price in any way
 * that survives a stable fixed-scale comparison (filters binary float noise only).
 */
export function oddsDriftedFromStored(locked: number, live: number): boolean {
  if (!Number.isFinite(locked) || !Number.isFinite(live) || locked <= 0 || live <= 0) {
    return false;
  }
  return (
    Math.round(locked * DRIFT_COMPARE_SCALE) !==
    Math.round(live * DRIFT_COMPARE_SCALE)
  );
}

/** Human-readable endpoints for drift copy (2dp when enough, else 4dp). */
export function formatDriftDecimalPair(locked: number, live: number): string {
  if (locked.toFixed(2) !== live.toFixed(2)) {
    return `${locked.toFixed(2)} → ${live.toFixed(2)}`;
  }
  return `${locked.toFixed(4)} → ${live.toFixed(4)}`;
}

/**
 * Parse stored slip odds (decimal string or "—") and format for display.
 */
export function formatStoredOddsString(
  stored: string,
  format: OddsFormat,
): string {
  const n = parseStoredDecimalOdds(stored);
  if (n == null) {
    return "—";
  }
  return formatOddsValue(n, format);
}
