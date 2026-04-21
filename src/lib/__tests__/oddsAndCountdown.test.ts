import { describe, expect, it } from "vitest";
import {
  formatDriftDecimalPair,
  oddsDriftedFromStored,
} from "@/lib/oddsFormat";
import {
  formatFootballLiveMinute,
  formatLiveBadgeTimer,
  isSuspiciousLiveClockToken,
} from "@/lib/useCountdown";

describe("oddsDriftedFromStored", () => {
  it("treats identical prices as no drift", () => {
    expect(oddsDriftedFromStored(2.105, 2.105)).toBe(false);
  });
  it("detects sub-cent drift at 1e6 scale", () => {
    expect(oddsDriftedFromStored(2.1, 2.100001)).toBe(true);
  });
  it("rejects invalid", () => {
    expect(oddsDriftedFromStored(NaN, 2)).toBe(false);
    expect(oddsDriftedFromStored(2, 0)).toBe(false);
  });
});

describe("formatDriftDecimalPair", () => {
  it("uses 2dp when 2dp strings differ", () => {
    expect(formatDriftDecimalPair(2.1, 2.2)).toBe("2.10 → 2.20");
  });
});

describe("isSuspiciousLiveClockToken", () => {
  it("flags epoch-like minute tokens", () => {
    expect(isSuspiciousLiveClockToken("1776805123440")).toBe(true);
  });
  it("allows normal match minutes", () => {
    expect(isSuspiciousLiveClockToken("45")).toBe(false);
  });
});

describe("formatFootballLiveMinute", () => {
  it("rejects epoch-like clock_tm", () => {
    expect(
      formatFootballLiveMinute(undefined, {
        clock_tm: "1776805123440",
      } as never),
    ).toBeNull();
  });
  it("formats 45+2 from scoreboard", () => {
    expect(
      formatFootballLiveMinute(
        { time: "45+2", goals: { home: 1, away: 0 } } as never,
        undefined,
      ),
    ).toBe("45+2'");
  });
});

describe("formatLiveBadgeTimer", () => {
  it("falls back to elapsed for basketball when time token is garbage", () => {
    const start = String(Math.floor(Date.now() / 1000) - 120);
    const now = Date.now();
    const out = formatLiveBadgeTimer(
      "basketball",
      start,
      {
        total: { h: 1, g: 0 },
        time: "1776805123440",
      } as never,
      undefined,
      now,
    );
    expect(out).not.toContain("1776805123440");
    expect(out).toMatch(/\d+:\d{2}/);
  });

  it("shows scoreboard clock for basketball when present", () => {
    const start = String(Math.floor(Date.now() / 1000) - 600);
    const now = Date.now();
    const out = formatLiveBadgeTimer(
      "basketball",
      start,
      {
        total: { h: 2, g: 0 },
        time: "12:34",
      } as never,
      undefined,
      now,
    );
    expect(out).toBe("12:34");
  });
});
