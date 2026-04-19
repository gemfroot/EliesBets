#!/usr/bin/env node
/**
 * Lightweight static checks on src/ (no grep required on Windows).
 * - Flags obvious localhost / 127.0.0.1 outside known allowlist
 * - Flags scary secret-like patterns in app source (not contracts/)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** Paths relative to `src/` (see walk() relPath). */
const ALLOWLIST_FILES = new Set(["lib/siteUrl.ts"]);

const LOCALHOST_RE = /\b(localhost|127\.0\.0\.1)\b/;
const SECRET_RE = /\b(sk_live_|sk_test_|AIza[0-9A-Za-z_-]{20,}|DEPLOYER_PRIVATE_KEY\s*=\s*0x)/;
/** PEM / SSH private key material must never live in app source. */
const PEM_PRIVATE_RE =
  /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/;

let issues = 0;

function walk(dir, rel = "") {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${name.name}` : name.name;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walk(full, relPath);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name.name)) {
      scanFile(full, relPath);
    }
  }
}

function scanFile(full, relPath) {
  const text = fs.readFileSync(full, "utf8");
  const lines = text.split(/\r?\n/);
  const norm = relPath.split(path.sep).join("/");

  lines.forEach((line, i) => {
    if (LOCALHOST_RE.test(line)) {
      if (ALLOWLIST_FILES.has(norm) && line.includes("localhost:3000")) return;
      console.error(`${norm}:${i + 1}: localhost/127 — ${line.trim()}`);
      issues += 1;
    }
    if (SECRET_RE.test(line)) {
      console.error(`${norm}:${i + 1}: possible secret pattern — redact if real`);
      issues += 1;
    }
    if (PEM_PRIVATE_RE.test(line)) {
      console.error(`${norm}:${i + 1}: PEM/private key block — never commit keys in source`);
      issues += 1;
    }
  });
}

if (!fs.existsSync(SRC)) {
  console.error("No src/ directory");
  process.exit(1);
}

walk(SRC);

if (issues > 0) {
  console.error(`\ncheck-static-sources: ${issues} issue(s)`);
  process.exit(1);
}

console.log("check-static-sources: OK (src/)");
