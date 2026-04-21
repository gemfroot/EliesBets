import type { Bet } from "@azuro-org/sdk";

/**
 * Whether this bet should be offered for payout redemption.
 *
 * Azuro `useRedeemBet` covers **winning or canceled** bets. We avoid the overly-narrow
 * `isWin && !isCanceled` gate (subgraph/SDK can expose `isRedeemable` without a clean win
 * flag) but we also avoid blind trust of `isRedeemable` alone (indexer quirks / reverts):
 * - Reject losses, rejected slips, and already redeemed.
 * - Allow canceled (refund path) and standard wins.
 * - For other redeemable non-loss rows, require a **resolved** timestamp and positive
 *   `possibleWin` so we do not spam txs on empty payout intent.
 */
export function betIsClaimable(bet: Bet): boolean {
  if (!bet.isRedeemable || bet.isRedeemed) return false;
  if (bet.isLose) return false;
  if (bet.isRejected) return false;
  if (bet.isCanceled) return true;
  if (bet.isWin && !bet.isCanceled) return true;
  return (
    bet.resolvedAt != null &&
    Number.isFinite(bet.possibleWin) &&
    bet.possibleWin > 0
  );
}

/** Expected wallet credit per slip; matches what Claim uses (payout when set, else possibleWin). */
function claimableExpectedPayout(bet: Bet): number {
  if (
    bet.payout != null &&
    Number.isFinite(bet.payout) &&
    bet.payout > 0
  ) {
    return bet.payout;
  }
  if (Number.isFinite(bet.possibleWin) && bet.possibleWin > 0) {
    return bet.possibleWin;
  }
  return 0;
}

/**
 * Sum of expected payouts for every claimable bet in `bets`. With the full settled
 * list loaded, this tracks wallet simulation / Claim all more closely than
 * `useBetsSummary().toPayout`, which can lag the subgraph.
 */
export function sumClaimableExpectedPayout(bets: readonly Bet[]): number {
  let s = 0;
  for (const b of bets) {
    if (!betIsClaimable(b)) continue;
    s += claimableExpectedPayout(b);
  }
  return s;
}
