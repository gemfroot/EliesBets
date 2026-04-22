"use client";

import type { BetToken, CasinoGame } from "@/lib/casino/addresses";
import { useCasinoBankState } from "@/lib/casino/useBankState";

/**
 * Visible pre-flight notice for casino games: if the Bank can't accept a
 * meaningful bet (paused token, insufficient liquidity, unconfigured bank),
 * surface the reason above the game controls instead of letting users sign
 * a tx that will revert.
 *
 * Re-reads on token/chain change so users can switch networks and see the
 * banner disappear once they land on a funded chain.
 */
export function CasinoBankBanner({
  chainId,
  betToken,
  /** Basis-points multiplier to probe the bank at (default 1.98× = 19800). */
  multiplierBps = 19_800n,
  /** Game key — routes the preflight to the bank that actually backs this game (ours vs BetSwirl's on Base). */
  game,
}: {
  chainId: number;
  betToken: BetToken;
  multiplierBps?: bigint;
  game?: CasinoGame;
}) {
  const { isOperational, statusLabel } = useCasinoBankState(
    chainId,
    betToken,
    multiplierBps,
    game,
  );
  if (isOperational || !statusLabel) {
    return null;
  }
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-amber-50">Casino not accepting bets on this network</p>
      <p className="text-amber-200/90">{statusLabel}</p>
      <p className="text-xs text-amber-300/80">
        Try switching networks in the header, or come back once the operator
        has topped up liquidity.
      </p>
    </div>
  );
}
