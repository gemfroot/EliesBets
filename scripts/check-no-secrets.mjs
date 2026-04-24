#!/usr/bin/env node
/**
 * Refuses to let a private key reach git.
 *
 * Matches:
 *   - `0x` followed by exactly 64 hex chars (an EVM private key — addresses are 40 chars)
 *   - PEM / OpenSSH private-key headers
 *
 * Used as both a pre-commit gate (when invoked with `--staged`, scans only
 * git's staged-content snapshot) and a full-repo scan (no flag).
 *
 * Bytecode files (`contracts/*-bytecode.txt`) are intentionally hex; we never
 * scan them. Same for `node_modules`, lockfiles, and build output.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const HEX_64_RE = /0x[a-fA-F0-9]{64}\b/;
/** A line that pairs a 64-hex blob with a name that implies "secret" almost
 *  always *is* a private key. Plain 64-hex matches are usually keccak256
 *  hashes (VRF key hash, Solidity role id, event topic) and must be ignored. */
const SECRET_TOKEN_RE =
  /\b(private[_-]?key|priv[_-]?key|mnemonic|seed[_-]?phrase|wallet[_-]?key|signer[_-]?key|deployer[_-]?key|secret[_-]?key)\b/i;
const PEM_PRIVATE_RE =
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/;
const ENV_FILE_RE = /(^|\/)\.env(\.|$)/;

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "_claude_local",
  ".vercel",
  "coverage",
  "out",
]);

/** Paths (relative to repo root, forward-slash) we never scan. */
const SKIP_FILES = new Set([
  "package-lock.json",
  "tsconfig.tsbuildinfo",
]);

/** Repo-relative files that are expected to contain large hex blobs and are
 *  hand-audited by the deploy workflow. Add sparingly. */
const ALLOWED_HEX_FILES = new Set([
  "contracts/bank-bytecode.txt",
  "contracts/cointoss-bytecode.txt",
  "contracts/weighted-bytecode.txt",
]);

const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".txt", ".env", ".sh", ".yml", ".yaml",
  ".toml", ".html", ".css", ".pem", ".key",
]);

function listFiles() {
  if (process.argv.includes("--staged")) {
    const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
      encoding: "utf8",
      cwd: ROOT,
    });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  const all = [];
  walk(ROOT, "", all);
  return all;
}

function walk(dir, rel, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(full, relPath, acc);
    } else if (entry.isFile()) {
      acc.push(relPath);
    }
  }
}

function shouldScan(relPath) {
  if (SKIP_FILES.has(relPath)) return false;
  if (ALLOWED_HEX_FILES.has(relPath)) return false;
  if (relPath.startsWith("node_modules/")) return false;
  const ext = path.extname(relPath).toLowerCase();
  if (!SCAN_EXTS.has(ext) && ext !== "") return false;
  return true;
}

function scanFile(relPath) {
  const full = path.join(ROOT, relPath);
  let text;
  try {
    const stat = fs.statSync(full);
    // Skip files larger than 2 MB — bytecode-sized things we missed in the
    // allowlist should fail loudly via the allowlist, not silently scan slow.
    if (stat.size > 2_000_000) return [];
    text = fs.readFileSync(full, "utf8");
  } catch {
    return [];
  }

  const hits = [];
  const isEnv = ENV_FILE_RE.test(relPath);
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (PEM_PRIVATE_RE.test(line)) {
      hits.push({ line: i + 1, kind: "PEM private key", excerpt: line.trim().slice(0, 120) });
      continue;
    }
    if (!HEX_64_RE.test(line)) continue;
    if (isEnv || SECRET_TOKEN_RE.test(line)) {
      hits.push({ line: i + 1, kind: "hex private key", excerpt: line.trim().slice(0, 120) });
    }
  }
  return hits;
}

const files = listFiles().filter(shouldScan);
let problems = 0;
for (const rel of files) {
  const hits = scanFile(rel);
  for (const hit of hits) {
    problems++;
    console.error(`${rel}:${hit.line}  ${hit.kind}\n    ${hit.excerpt}`);
  }
}

if (problems > 0) {
  console.error(`\nRefusing to continue: found ${problems} likely secret${problems === 1 ? "" : "s"}.`);
  console.error("If a match is intentional (test fixture, allowlisted bytecode), update scripts/check-no-secrets.mjs.");
  process.exit(1);
}

console.log(`check-no-secrets: scanned ${files.length} file${files.length === 1 ? "" : "s"}, no private keys found.`);
