import { describe, expect, it } from "vitest";
import { polygon, gnosis, base } from "viem/chains";
import { rewriteChainInPath } from "@/lib/chainRoute";

describe("rewriteChainInPath", () => {
  describe("on chain-scoped sports routes (swap segment in place)", () => {
    it("swaps /[chain] home", () => {
      expect(rewriteChainInPath("/polygon", base.id)).toBe("/base");
    });
    it("swaps /[chain]/live", () => {
      expect(rewriteChainInPath("/polygon/live", gnosis.id)).toBe(
        "/gnosis/live",
      );
    });
    it("swaps /[chain]/sports/[slug]/[country]/[league]", () => {
      expect(
        rewriteChainInPath(
          "/polygon/sports/soccer/germany/bundesliga",
          base.id,
        ),
      ).toBe("/base/sports/soccer/germany/bundesliga");
    });
    it("returns the same path when target equals current chain", () => {
      // Idempotent — caller already short-circuits, but double-check.
      expect(rewriteChainInPath("/polygon/sports", polygon.id)).toBe(
        "/polygon/sports",
      );
    });
  });

  describe("on /games/[id] (regression for header-chain-switch bug)", () => {
    it("redirects to the new chain's sports home (not stay put)", () => {
      // Pre-fix: returned null → URL stayed at /games/abc, but cookie / SDK
      // chain followed the wallet, leaving the page mismatched. Post-fix:
      // navigate to the new chain's sports home.
      expect(rewriteChainInPath("/games/abc123", base.id)).toBe(
        "/base/sports",
      );
    });
    it("works for every supported chain", () => {
      expect(rewriteChainInPath("/games/abc", polygon.id)).toBe(
        "/polygon/sports",
      );
      expect(rewriteChainInPath("/games/abc", gnosis.id)).toBe(
        "/gnosis/sports",
      );
      expect(rewriteChainInPath("/games/abc", base.id)).toBe("/base/sports");
    });
  });

  describe("on routes the chain switch should NOT navigate away from", () => {
    it.each([
      ["/", "root"],
      ["/bets", "bets (cross-chain by design)"],
      ["/casino", "casino landing (wallet-driven)"],
      ["/casino/coin-toss", "casino game"],
      ["/casino/dice", "casino game"],
      ["/casino/plinko", "casino game"],
      ["/privacy", "legal page"],
      ["/terms", "legal page"],
    ])("%s → null  (%s)", (path) => {
      expect(rewriteChainInPath(path, base.id)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("treats unknown chain ids as no-op", () => {
      // The type system blocks this normally; runtime guard keeps it safe.
      expect(
        rewriteChainInPath(
          "/polygon/sports",
          999999 as unknown as Parameters<typeof rewriteChainInPath>[1],
        ),
      ).toBeNull();
    });
    it("handles trailing slashes gracefully", () => {
      expect(rewriteChainInPath("/polygon/sports/", base.id)).toBe(
        "/base/sports",
      );
    });
    it("preserves deeper chain-scoped paths", () => {
      expect(
        rewriteChainInPath(
          "/polygon/sports/soccer/spain/laliga",
          gnosis.id,
        ),
      ).toBe("/gnosis/sports/soccer/spain/laliga");
    });
  });
});
