import type { Bet } from "@azuro-org/sdk";
import type { GameData } from "@azuro-org/toolkit";
import type { Hex } from "viem";
import type { OddsFormat } from "@/lib/oddsFormat";
import { formatOddsValue, formatStoredOddsString } from "@/lib/oddsFormat";
import { explorerTxUrl } from "@/lib/chains";

const APP_LABEL = "Eliesbets";

/** Block explorer URL for a tx (Azuro `appChain` explorer when set; else `chains.explorerTxUrl`). */
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
  return explorerTxUrl(chainId, hash) ?? null;
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

function copyViaExecCommand(value: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function tryNavigatorShare(text: string): Promise<"shared" | "aborted" | "skip"> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "skip";
  }

  const payloads: ShareData[] = [
    { text, title: `${APP_LABEL} bet` },
    { text },
  ];

  for (const payload of payloads) {
    if (
      typeof navigator.canShare === "function" &&
      !navigator.canShare(payload)
    ) {
      continue;
    }
    try {
      await navigator.share(payload);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "aborted";
      }
      /* Wrong payload / not allowed — try next shape or fall back to copy */
    }
  }

  /* Some Chromium builds report `canShare` false for text-only yet `share({ text })` still works. */
  try {
    await navigator.share({ text });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return "aborted";
    }
  }

  return "skip";
}

/**
 * Web Share when the browser allows it; otherwise clipboard (`writeText` or legacy
 * `execCommand('copy')`). Desktop Chrome often reports `canShare` false for `{ text, title }`
 * only, so we try `{ text }` as well before copying.
 */
export async function shareOrCopyBetText(text: string): Promise<ShareBetTextResult> {
  if (typeof navigator === "undefined") {
    return "failed";
  }

  const shareResult = await tryNavigatorShare(text);
  if (shareResult === "shared") {
    return "shared";
  }
  if (shareResult === "aborted") {
    return "aborted";
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* fall through */
  }

  if (copyViaExecCommand(text)) {
    return "copied";
  }

  return "failed";
}
