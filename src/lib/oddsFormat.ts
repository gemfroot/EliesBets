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
  return "decimal";
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

/** Profit (decimal − 1) as a simplified fraction, denominator ≤ maxDen. */
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
    if (err < bestErr) {
      bestErr = err;
      bestN = num;
      bestD = den;
    }
  }
  const g = gcd(bestN, bestD);
  return [bestN / g, bestD / g];
}

function formatFractionalFromDecimal(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    return "—";
  }
  const profit = decimal - 1;
  const [n, d] = profitToSimplifiedFraction(profit, 1000);
  if (n <= 0 || d <= 0) {
    return "—";
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

/**
 * Parse stored slip odds (decimal string or "—") and format for display.
 */
export function formatStoredOddsString(
  stored: string,
  format: OddsFormat,
): string {
  const trimmed = stored.trim();
  if (trimmed === "" || trimmed === "—") {
    return "—";
  }
  const n = Number.parseFloat(trimmed.replace(",", "."));
  return formatOddsValue(n, format);
}
