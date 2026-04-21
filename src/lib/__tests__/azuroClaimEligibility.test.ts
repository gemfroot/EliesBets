import { describe, expect, it } from "vitest";
import {
  betIsClaimable,
  sumClaimableExpectedPayout,
} from "@/lib/azuroClaimEligibility";
import type { Bet } from "@azuro-org/sdk";

function baseBet(over: Partial<Bet>): Bet {
  return {
    tokenId: "1",
    amount: 1,
    odds: 2,
    possibleWin: 2,
    payout: null,
    isRedeemable: true,
    isRedeemed: false,
    isWin: true,
    isLose: false,
    isCanceled: false,
    isRejected: false,
    resolvedAt: null,
    freebetId: null,
    ...over,
  } as Bet;
}

describe("betIsClaimable", () => {
  it("allows standard win", () => {
    expect(betIsClaimable(baseBet({ isWin: true, isCanceled: false }))).toBe(
      true,
    );
  });

  it("allows canceled redeemable", () => {
    expect(betIsClaimable(baseBet({ isWin: false, isCanceled: true }))).toBe(
      true,
    );
  });

  it("rejects redeemed", () => {
    expect(betIsClaimable(baseBet({ isRedeemed: true }))).toBe(false);
  });

  it("rejects loss", () => {
    expect(betIsClaimable(baseBet({ isLose: true, isWin: false }))).toBe(false);
  });

  it("rejects rejected slip", () => {
    expect(betIsClaimable(baseBet({ isRejected: true }))).toBe(false);
  });

  it("rejects not redeemable", () => {
    expect(betIsClaimable(baseBet({ isRedeemable: false }))).toBe(false);
  });

  it("allows redeemable non-win when resolved with positive possibleWin", () => {
    expect(
      betIsClaimable(
        baseBet({
          isWin: false,
          isCanceled: false,
          resolvedAt: 1,
          possibleWin: 1.5,
        }),
      ),
    ).toBe(true);
  });
});

describe("sumClaimableExpectedPayout", () => {
  it("prefers payout over possibleWin", () => {
    const a = baseBet({
      payout: 3,
      possibleWin: 9,
    });
    expect(sumClaimableExpectedPayout([a])).toBe(3);
  });

  it("skips non-claimable rows", () => {
    const win = baseBet({ isWin: true });
    const lost = baseBet({
      isWin: false,
      isLose: true,
      isRedeemable: false,
    });
    expect(sumClaimableExpectedPayout([win, lost])).toBe(2);
  });
});
