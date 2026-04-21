import type { Bet } from "@azuro-org/sdk";

function shouldEmitClaimLogs(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_CLAIM_DEBUG === "1"
  );
}

/** Safe fields for diagnosing claim / redeem failures (dev, or prod when NEXT_PUBLIC_CLAIM_DEBUG=1). */
export function claimBetDebugSlice(bet: Bet) {
  return {
    orderId: bet.orderId,
    tokenId: bet.tokenId,
    lpAddress: bet.lpAddress,
    coreAddress: bet.coreAddress,
    isWin: bet.isWin,
    isLose: bet.isLose,
    isCanceled: bet.isCanceled,
    isRejected: bet.isRejected,
    isRedeemable: bet.isRedeemable,
    isRedeemed: bet.isRedeemed,
    isCashedOut: bet.isCashedOut,
    status: bet.status,
    freebetId: bet.freebetId,
    possibleWin: bet.possibleWin,
    payout: bet.payout,
    resolvedAt: bet.resolvedAt,
  };
}

export function logClaimFailure(
  label: string,
  error: unknown,
  bets?: Bet[],
): void {
  if (!shouldEmitClaimLogs()) return;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  const payload = {
    label,
    message,
    bets: bets?.map(claimBetDebugSlice),
  };
  console.error("[claim]", JSON.stringify(payload));
}
