#!/usr/bin/env node
/**
 * Ensures `next build` output lists the casino routes (guards against accidental removal).
 */
import { execSync } from "node:child_process";

const need = ["/casino", "/casino/coin-toss"];

const out = execSync("npm run build", {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

const missing = need.filter((route) => !out.includes(route));
if (missing.length > 0) {
  console.error(
    "verify-casino-build: build output missing expected routes:",
    missing.join(", "),
  );
  process.exit(1);
}

console.log("verify-casino-build: OK (casino routes present in build output)");
