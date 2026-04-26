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

  it("returns 0 for an empty list", () => {
    expect(sumClaimableExpectedPayout([])).toBe(0);
  });

  it("returns 0 when no rows pass the claimable gate", () => {
    const lost = baseBet({ isWin: false, isLose: true, isRedeemable: false });
    const redeemed = baseBet({ isRedeemed: true });
    const rejected = baseBet({ isRejected: true });
    expect(
      sumClaimableExpectedPayout([lost, redeemed, rejected]),
    ).toBe(0);
  });

  it("falls back from payout to possibleWin when payout is non-positive", () => {
    const zeroPayout = baseBet({ payout: 0, possibleWin: 7 });
    expect(sumClaimableExpectedPayout([zeroPayout])).toBe(7);
    const negPayout = baseBet({ payout: -2, possibleWin: 5 });
    expect(sumClaimableExpectedPayout([negPayout])).toBe(5);
  });

  it("falls back from payout to possibleWin when payout is NaN/Infinity", () => {
    const nanPayout = baseBet({ payout: NaN, possibleWin: 4 });
    expect(sumClaimableExpectedPayout([nanPayout])).toBe(4);
    const infPayout = baseBet({ payout: Infinity, possibleWin: 4 });
    expect(sumClaimableExpectedPayout([infPayout])).toBe(4);
  });

  it("returns 0 for a claimable row with no positive payout or possibleWin", () => {
    // Canceled / refunded with both signals zero — claimable per the gate but
    // contributes nothing to the running total (so the strip stays calm).
    const refundZero = baseBet({
      isWin: false,
      isCanceled: true,
      payout: 0,
      possibleWin: 0,
    });
    expect(sumClaimableExpectedPayout([refundZero])).toBe(0);
  });

  it("never sums to negative even when individual fields go negative", () => {
    const a = baseBet({ payout: -10, possibleWin: -5 });
    const b = baseBet({ payout: -1, possibleWin: 8 });
    // a contributes 0 (both signals non-positive); b uses possibleWin=8.
    expect(sumClaimableExpectedPayout([a, b])).toBe(8);
  });

  it("handles a mix of claimable and non-claimable cleanly", () => {
    const winA = baseBet({ payout: 12.5 });
    const winB = baseBet({ payout: null, possibleWin: 7.25 });
    const cancelled = baseBet({
      isWin: false,
      isCanceled: true,
      payout: 1,
      possibleWin: 1,
    });
    const lost = baseBet({ isWin: false, isLose: true, isRedeemable: false });
    expect(
      sumClaimableExpectedPayout([winA, winB, cancelled, lost]),
    ).toBeCloseTo(12.5 + 7.25 + 1, 6);
  });

  it("survives floating-point dust without going negative", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS — the sum should never round
    // negative or NaN.
    const rows = Array.from({ length: 100 }, (_, i) =>
      baseBet({ payout: 0.1, possibleWin: 0.1, tokenId: String(i) }),
    );
    const total = sumClaimableExpectedPayout(rows);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeCloseTo(10, 5);
  });

  it("does not double-count when a bet has only possibleWin", () => {
    // Documents the indexer/slip skew protection: when payout is null but
    // possibleWin is set, we use possibleWin once — never both.
    const onlyPossible = baseBet({ payout: null, possibleWin: 4 });
    expect(sumClaimableExpectedPayout([onlyPossible])).toBe(4);
  });
});
