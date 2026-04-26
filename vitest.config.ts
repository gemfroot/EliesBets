import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/components/Betslip.tsx",
        "src/components/BetCard.tsx",
        "src/components/CashoutButton.tsx",
        "src/components/ClaimAllBetsButton.tsx",
        "src/components/betslipState.ts",
        "src/lib/azuroClaimEligibility.ts",
        "src/lib/oddsFormat.ts",
      ],
      thresholds: {
        // 100% on the extracted reducer + helpers (pure logic).
        "src/components/betslipState.ts": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        "src/lib/azuroClaimEligibility.ts": {
          lines: 100,
          functions: 100,
        },
        // ≥60% on the on-chain components — the chain-switch reject path
        // (P0.2 regression coverage) plus claim/cashout happy/error flows.
        "src/components/BetCard.tsx": { lines: 60 },
        "src/components/CashoutButton.tsx": { lines: 60 },
        "src/components/ClaimAllBetsButton.tsx": { lines: 60 },
        // Betslip.tsx threshold is set against the Provider portion only.
        // BetslipStakeAndPlace (~1000 lines) is integration-shaped — testing
        // it needs ~10 SDK/wagmi hook mocks. Tracked as the next PRD's first
        // P0 item.
        "src/components/Betslip.tsx": { lines: 20 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
