# EliesBets contracts

Solidity sources, compiled bytecode, and deploy scripts for the on-chain casino games (Bank, CoinToss, weighted Plinko/Wheel/Keno/Roulette/Dice). Sports betting is delegated to Azuro and has no contracts here.

## Mainnet deploys: hardware wallet only

Deploy and admin scripts in this directory accept `DEPLOYER_PRIVATE_KEY` from the environment for convenience on testnets. **Do not paste a mainnet hot-wallet key into your shell or `.env` file.**

For any mainnet action — deploy, role assignment, VRF subscription change, ownership transfer — sign with a hardware wallet (Ledger / Trezor) via:

- `cast send --ledger ...` (foundry) for one-off calls; or
- a multisig (Safe) when funds are at risk.

Reasoning: a key in a shell environment leaks via shell history, process listings, crash dumps, and any tool that snapshots env. A hardware wallet never exposes the key to the host.

## Secret-leak guard

`npm run check:secrets` scans the whole repo. `npm run check:secrets:staged` scans only what `git` is about to commit (suitable for a pre-commit hook).

The detector flags:
- `0x` + 64 hex chars on a line that also names something secret (`PRIVATE_KEY`, `MNEMONIC`, `WALLET_KEY`, …);
- any `0x` + 64 hex chars in a `.env*` file;
- PEM / OpenSSH `BEGIN PRIVATE KEY` blocks anywhere.

It does **not** flag bare hash literals (VRF key hashes, Solidity role ids, event topics) so legitimate constants stay quiet.

If you intentionally check in test fixtures that look like secrets, add the file to `ALLOWED_HEX_FILES` in `scripts/check-no-secrets.mjs` with a comment explaining why.

## Bytecode files

`bank-bytecode.txt`, `cointoss-bytecode.txt`, and `weighted-bytecode.txt` are committed so deploys are reproducible without a local solc toolchain. They are listed in `ALLOWED_HEX_FILES` so the secret guard skips them.

There is no automated build step yet linking source to bytecode — the PRD (`docs/PRD_ASSESSMENT_2026_04_24.md` item 18) tracks adding `npm run build:contracts` and a CI parity check.

## Layout

| Path | What it is |
|------|------------|
| `bank/`, `cointoss/`, `remix/` | Solidity sources by game / deployment context |
| `*-bytecode.txt` | Compiled bytecode used by the deploy scripts |
| `deploy-fuji.js`, `deploy-mainnet.js` | One-shot deploy entry points |
| `redeploy-cointoss.js` | Re-deploy a single game (Fuji) |
| `set-vrf-sub.js`, `set-vrf-sub-mainnet.js` | Bind a VRF subscription to deployed games |
| `test-bet.js`, `test-bet-mainnet.js` | Smoke a single bet end-to-end |
| `check-bytecode.js`, `build-deploy-script.js` | Local utilities |
