"use client";

import Link from "next/link";
import { useBetsSummary, useChain, useRedeemBet, type Bet } from "@azuro-org/sdk";
import type { GameData } from "@azuro-org/toolkit";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { getBalanceQueryKey } from "wagmi/query";
import { useConnection } from "wagmi";
import { useAzuroActionChain } from "@/lib/useAzuroActionChain";
import { AzuroWrongChainCallout } from "@/components/AzuroWrongChainCallout";
import { CashoutButton } from "@/components/CashoutButton";
import { useOddsFormat } from "@/components/OddsFormatProvider";
import { useToast } from "@/components/Toast";
import {
  formatBetHistoryShareText,
  shareOrCopyBetText,
  txExplorerUrlFromAppChain,
} from "@/lib/betShare";
import { formatOddsValue } from "@/lib/oddsFormat";
import { betIsClaimable } from "@/lib/azuroClaimEligibility";
import { logClaimFailure } from "@/lib/claimDebugLog";
import { formatWalletTxError } from "@/lib/userFacingTxError";
import { formatStartTime } from "@/lib/useCountdown";

function participantLine(game: GameData): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}

function statusLabel(bet: Bet): string {
  if (bet.isCanceled) return "Canceled";
  if (bet.isCashedOut) return "Cashed out";
  if (bet.isWin) return "Won";
  if (bet.isLose) return "Lost";
  return "Pending";
}

function statusClass(bet: Bet): string {
  if (bet.isCanceled) return "bg-zinc-700 text-zinc-200";
  if (bet.isCashedOut) return "bg-amber-900/60 text-amber-100";
  if (bet.isWin) return "bg-emerald-900/60 text-emerald-100";
  if (bet.isLose) return "bg-red-900/50 text-red-100";
  return "bg-zinc-700 text-zinc-200";
}

export type BetCardProps = {
  bet: Bet;
};

export function BetCard({ bet }: BetCardProps) {
  const { format: oddsFormat } = useOddsFormat();
  const { betToken, appChain } = useChain();
  const { showToast } = useToast();
  const { address } = useConnection();
  const azuroChain = useAzuroActionChain();
  const queryClient = useQueryClient();
  const { refetch: refetchBetsSummary } = useBetsSummary({
    account: address ?? "",
    query: { enabled: Boolean(address) },
  });
  const { submit, isPending, isProcessing } = useRedeemBet();
  const [claimError, setClaimError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const shareInFlightRef = useRef(false);

  const showClaim = betIsClaimable(bet);

  const invalidateBalances = useCallback(() => {
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: getBalanceQueryKey({ chainId: appChain.id, address }),
      });
    }
  }, [address, appChain.id, queryClient]);

  const claimBusy = isPending || isProcessing;

  // `Bet.amount` from Azuro is already a human token amount (see SDK: possibleWin = +amount * totalOdds), not raw wei.
  const stakeNum = Number.parseFloat(bet.amount);
  const stakeDisplay = Number.isFinite(stakeNum)
    ? stakeNum.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : bet.amount;

  const payoutDisplay =
    bet.payout != null && Number.isFinite(bet.payout)
      ? bet.payout.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";

  const possibleWinDisplay = Number.isFinite(bet.possibleWin)
    ? bet.possibleWin.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  const oddsDisplay = Number.isFinite(bet.totalOdds)
    ? formatOddsValue(bet.totalOdds, oddsFormat)
    : "—";

  const isCombo = bet.outcomes.length > 1;

  const txExplorer = txExplorerUrlFromAppChain(
    appChain.id,
    appChain.blockExplorers?.default?.url,
    bet.txHash,
  );

  const handleShare = useCallback(async () => {
    if (shareInFlightRef.current) {
      return;
    }
    shareInFlightRef.current = true;
    setShareBusy(true);
    try {
      const text = formatBetHistoryShareText(
        bet,
        stakeDisplay,
        possibleWinDisplay,
        payoutDisplay,
        oddsDisplay,
        betToken.symbol,
        oddsFormat,
        txExplorer,
      );
      const result = await shareOrCopyBetText(text);
      if (result === "shared") {
        showToast("Shared.", "success");
      } else if (result === "copied") {
        showToast("Bet copied to clipboard.", "success");
      } else if (result === "aborted") {
        showToast("Share cancelled.", "info");
      } else if (result === "failed") {
        showToast("Could not share or copy.", "error");
      }
    } finally {
      shareInFlightRef.current = false;
      setShareBusy(false);
    }
  }, [
    bet,
    betToken.symbol,
    oddsDisplay,
    oddsFormat,
    payoutDisplay,
    possibleWinDisplay,
    showToast,
    stakeDisplay,
    txExplorer,
  ]);

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {isCombo ? `Combo · ${bet.outcomes.length} selections` : "Single"}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{bet.orderId}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={shareBusy}
            onClick={() => void handleShare()}
            className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shareBusy ? "Sharing…" : "Share"}
          </button>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(bet)}`}
          >
            {statusLabel(bet)}
          </span>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {bet.outcomes.map((o) => {
          const g = o.game;
          const title = g ? participantLine(g) : "Game unavailable";
          const when = g ? formatStartTime(g.startsAt) : null;
          return (
            <li key={`${o.conditionId}-${o.outcomeId}`} className="text-sm">
              {g ? (
                <h3 className="font-medium text-zinc-100">
                  <Link
                    href={`/games/${g.gameId}`}
                    className="hover:text-zinc-50 hover:underline"
                  >
                    {title}
                  </Link>
                </h3>
              ) : (
                <h3 className="font-medium text-zinc-400">{title}</h3>
              )}
              {when ? (
                <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                  {when}
                </p>
              ) : null}
              <p className="mt-1 text-zinc-200">{o.selectionName}</p>
              <p className="text-xs text-zinc-500">{o.marketName}</p>
              {isCombo ? (
                <p className="mt-0.5 font-mono text-xs tabular-nums text-zinc-400">
                  @{formatOddsValue(o.odds, oddsFormat)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800/80 pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Odds</dt>
          <dd className="type-odds text-zinc-100">
            {oddsDisplay}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Stake ({betToken.symbol})</dt>
          <dd className="font-mono font-semibold tabular-nums text-zinc-100">
            {stakeDisplay}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Potential payout</dt>
          <dd className="font-mono font-semibold tabular-nums text-zinc-100">
            {possibleWinDisplay}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Payout</dt>
          <dd className="font-mono font-semibold tabular-nums text-zinc-100">
            {payoutDisplay}
          </dd>
        </div>
      </dl>

      {showClaim ? (
        <div className="mt-3 border-t border-zinc-800/80 pt-3">
          {!azuroChain.onBetChain ? (
            <AzuroWrongChainCallout
              appChainName={azuroChain.appChainName}
              walletChainName={azuroChain.walletChainName}
              switchPending={azuroChain.switchPending}
              onSwitch={() => void azuroChain.switchToAppChain().catch(() => {})}
            />
          ) : null}
          {claimError ? (
            <p className="mb-2 text-sm text-red-400" role="alert">
              {claimError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={claimBusy || !azuroChain.onBetChain}
            onClick={async () => {
              setClaimError(null);
              try {
                await submit({ bets: [bet] });
                invalidateBalances();
                void refetchBetsSummary();
                showToast("Winnings claimed.", "success");
              } catch (e) {
                logClaimFailure("claim_single", e, [bet]);
                setClaimError(formatWalletTxError(e));
              }
            }}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {claimBusy ? "Claiming…" : "Claim"}
          </button>
        </div>
      ) : null}

      <CashoutButton bet={bet} />
    </article>
  );
}
