import type { Bet } from "@azuro-org/sdk";
import type { GameData } from "@azuro-org/toolkit";
import type { Hex } from "viem";
import { gnosis, polygon, polygonAmoy } from "viem/chains";
import type { OddsFormat } from "@/lib/oddsFormat";
import { formatOddsValue, formatStoredOddsString } from "@/lib/oddsFormat";

const APP_LABEL = "Eliesbets";

function txExplorerUrlForKnownChain(
  chainId: number,
  hash: Hex,
): string | null {
  const base =
    chainId === polygon.id
      ? "https://polygonscan.com"
      : chainId === gnosis.id
        ? "https://gnosisscan.io"
        : chainId === polygonAmoy.id
          ? "https://amoy.polygonscan.com"
          : null;
  return base ? `${base}/tx/${hash}` : null;
}

/** Block explorer URL for a tx, matching in-app links (Azuro chain + Polygon fallbacks). */
export function txExplorerUrlFromAppChain(
  chainId: number,
  blockExplorerDefaultUrl: string | undefined,
  hash: Hex | null | undefined,
): string | null {
  if (!hash) {
    return null;
  }
  if (blockExplorerDefaultUrl) {
    return `${blockExplorerDefaultUrl.replace(/\/$/, "")}/tx/${hash}`;
  }
  return txExplorerUrlForKnownChain(chainId, hash);
}

export function participantLineForShare(game: GameData): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}

export function formatStartTimeForShare(startsAt: string): string {
  const ms = +startsAt < 32_503_680_000 ? +startsAt * 1000 : +startsAt;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function statusLabelForShare(bet: Bet): string {
  if (bet.isCanceled) return "Canceled";
  if (bet.isCashedOut) return "Cashed out";
  if (bet.isWin) return "Won";
  if (bet.isLose) return "Lost";
  return "Pending";
}

export type BetReceiptShareSelection = {
  gameTitle: string;
  outcomeName: string;
  odds: string;
};

export function formatBetReceiptShareText(
  selections: BetReceiptShareSelection[],
  stakeLabel: string,
  tokenSymbol: string,
  totalOdds: number,
  potentialWin: number | null,
  oddsFormat: OddsFormat,
  transactionHash: `0x${string}` | undefined,
  explorerUrl: string | null,
): string {
  const lines: string[] = [
    `${APP_LABEL} — Bet placed`,
    "",
    selections.length > 1
      ? `Combo · ${selections.length} selections`
      : "Single",
  ];

  selections.forEach((s, i) => {
    lines.push("");
    lines.push(`${selections.length > 1 ? `${i + 1}. ` : ""}${s.gameTitle}`);
    lines.push(`   ${s.outcomeName}`);
    lines.push(
      `   @${formatStoredOddsString(s.odds, oddsFormat)}`,
    );
  });

  lines.push("");
  lines.push(
    `Odds (combined): ${totalOdds > 0 ? formatOddsValue(totalOdds, oddsFormat) : "—"}`,
  );
  lines.push(`Stake (${tokenSymbol}): ${stakeLabel}`);
  lines.push(
    `Potential win: ${
      potentialWin != null
        ? `${potentialWin.toFixed(2)} ${tokenSymbol}`
        : "—"
    }`,
  );

  if (transactionHash) {
    lines.push("");
    lines.push("Transaction");
    lines.push(explorerUrl ?? transactionHash);
  }

  return lines.join("\n");
}

export function formatBetHistoryShareText(
  bet: Bet,
  stakeDisplay: string,
  possibleWinDisplay: string,
  payoutDisplay: string,
  oddsDisplay: string,
  tokenSymbol: string,
  oddsFormat: OddsFormat,
  explorerUrl: string | null,
): string {
  const lines: string[] = [
    `${APP_LABEL} — My bet`,
    "",
    `Order: ${bet.orderId}`,
    `Status: ${statusLabelForShare(bet)}`,
    "",
    bet.outcomes.length > 1
      ? `Combo · ${bet.outcomes.length} selections`
      : "Single",
  ];

  bet.outcomes.forEach((o, i) => {
    const g = o.game;
    const title = g ? participantLineForShare(g) : "Game unavailable";
    lines.push("");
    lines.push(`${bet.outcomes.length > 1 ? `${i + 1}. ` : ""}${title}`);
    if (g) {
      lines.push(`   ${formatStartTimeForShare(g.startsAt)}`);
    }
    lines.push(`   ${o.selectionName}`);
    lines.push(`   ${o.marketName}`);
    if (bet.outcomes.length > 1) {
      lines.push(`   @${formatOddsValue(o.odds, oddsFormat)}`);
    }
  });

  lines.push("");
  lines.push(`Odds: ${oddsDisplay}`);
  lines.push(`Stake (${tokenSymbol}): ${stakeDisplay}`);
  lines.push(`Potential payout: ${possibleWinDisplay}`);
  lines.push(`Payout: ${payoutDisplay}`);

  if (bet.txHash) {
    lines.push("");
    lines.push("Transaction");
    lines.push(explorerUrl ?? bet.txHash);
  }

  return lines.join("\n");
}

export type ShareBetTextResult = "shared" | "copied" | "aborted" | "failed";

/**
 * Uses Web Share API when available (typical on mobile); otherwise copies to clipboard.
 */
export async function shareOrCopyBetText(text: string): Promise<ShareBetTextResult> {
  if (typeof navigator === "undefined") {
    return "failed";
  }

  const payload: ShareData = { text, title: `${APP_LABEL} bet` };

  if (typeof navigator.share === "function") {
    const can =
      typeof navigator.canShare !== "function" || navigator.canShare(payload);
    if (can) {
      try {
        await navigator.share(payload);
        return "shared";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return "aborted";
        }
        // Fall through to clipboard
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
