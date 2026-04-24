# EliesBets — Code & UX Assessment PRD (2026-04-24)

Compiled from a full-codebase technical review and a UI/UX review of the live components. Each item carries **context, ask, files, and acceptance** so the next engineer can pick it up cold. Items are prioritised P0/P1/P2; do P0 before any regulated launch.

**Verdict at a glance.** Architecture and middleware are solid; chain abstraction is sensible; mobile-first intent is real. The risks are concentrated in (a) ABI type erasure and silent error handling on the Web3 path, (b) a thin test net under bet placement and claims, and (c) UX gaps in pre-submit confidence, empty states, and tx-pending feedback.

---

## P0 — Must fix before regulated launch

### 1. Type-safe casino ABIs (kill the `unknown as typeof ...` casts)

**Context.** `src/lib/casino/abis/` and `src/components/PendingBetsProvider.tsx:26` cast every BetSwirl ABI via `unknown as typeof coinTossAbi`. The compiler will accept *any* ABI shape against any contract call, so a wrong-contract read or a renamed event silently passes typecheck. This is the single highest-leverage type-safety hole in the codebase.

**Ask.**
- Define each ABI with `as const` and let `viem` infer types per contract; remove the cross-cast.
- Where multiple game contracts share an interface, use a discriminated union keyed by `gameKind`.
- Add one `expectTypeOf` (vitest) assertion per ABI so the cast can never come back unnoticed.

**Files.** `src/lib/casino/abis/*`, `src/lib/casino/hooks.ts`, `src/components/PendingBetsProvider.tsx`.

**Acceptance.**
- Zero `as unknown as` in `src/lib/casino/`.
- Wrong-contract write in a unit test fails to compile.

---

### 2. Surface `switchToAppChain` failures in claim/cashout/bet flows

**Context.** Three components silently swallow chain-switch errors mid-action:
- `src/components/BetCard.tsx:257`
- `src/components/CashoutButton.tsx:238`
- `src/components/ClaimAllBetsButton.tsx:399`

Each does `.catch(() => {})`. If the wallet rejects the switch, the user sees nothing and the next call fails for an unrelated-looking reason.

**Ask.**
- Replace empty catches with a toast via the existing `ToastProvider`. Copy: "Switch to {chainName} in your wallet to continue."
- Keep the action's busy state until the user either switches or cancels; do not auto-retry.
- Add one test per component asserting that a rejected switch produces a visible toast.

**Files.** As above; toast wiring via `src/components/Toast.tsx`.

**Acceptance.**
- Manual repro (reject switch in MetaMask) shows a toast and resets the button to its idle label.
- No empty `.catch(() => {})` left in `src/components/`.

---

### 3. Test coverage on bet placement, cashout, and claim

**Context.** Only two test files exist (`src/lib/__tests__/azuroClaimEligibility.test.ts`, `oddsAndCountdown.test.ts`, ~179 LOC total). The 1,740-LOC `Betslip.tsx`, the cashout flow, and every casino game are untested. Pre-launch checklist (`docs/PRE_LAUNCH_TEST_CHECKLIST.md`) is manual-only.

**Ask.**
- Stand up vitest + React Testing Library coverage for the Betslip reducer (every action arm), the odds-drift accept path, and the `canSubmit` gating matrix.
- Cover `azuroClaimEligibility.sumClaimableExpectedPayout` edge cases (zero, negative-after-rounding, indexer-vs-slip skew).
- Cover `CashoutButton` and `ClaimAllBetsButton` happy path + chain-switch reject + tx revert.
- Target ≥60% line coverage on `src/components/Betslip.tsx`, `BetCard.tsx`, `CashoutButton.tsx`, `ClaimAllBetsButton.tsx` and 100% on the reducers.

**Files.** New: `src/components/__tests__/Betslip.test.tsx`, `BetCard.test.tsx`, `CashoutButton.test.tsx`, `ClaimAllBetsButton.test.tsx`.

**Acceptance.**
- `npm run test` runs in CI (Vercel preview check) and blocks merge on red.
- Coverage report committed to PR comment via `vitest --coverage`.

---

### 4. Deployment-script secret hygiene

**Context.** `contracts/deploy-{mainnet,fuji}.js`, `set-vrf-sub*.js`, and `redeploy-cointoss.js` all depend on `process.env.DEPLOYER_PRIVATE_KEY`. No hardcoded keys are present today, but there is no guard preventing a `contracts/.env` from being committed.

**Ask.**
- Verify `.gitignore` excludes `contracts/.env`, `contracts/.env.*`, and any `*.key` file.
- Add a `pre-commit` hook (or CI step) that fails if any staged file matches a private-key regex (`/0x[a-fA-F0-9]{64}/`).
- Add a README banner at `contracts/README.md` instructing operators to use a hardware wallet for mainnet deploys.

**Files.** `.gitignore`, `contracts/README.md` (new or updated), `scripts/check-no-secrets.mjs` (new).

**Acceptance.**
- Attempting to commit a file containing a 64-hex string fails locally and in CI.
- `contracts/.env*` is in `.gitignore`.

---

## P1 — Significant correctness & UX gaps

### 5. Drop `any` in the chunked event reader

**Context.** `src/lib/casino/hooks.ts:73–96` uses three `any` casts around `getContractEventsChunked` to work around Base RPC range limits. Decoded logs land untyped; a silent decode failure would not surface.

**Ask.**
- Wrap the chunker in a typed adapter (`getContractEventsChunked<TAbi, TEventName>`) that returns `Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>>[]`.
- Throw on decode error rather than dropping the log.

**Files.** `src/lib/casino/hooks.ts`.

**Acceptance.**
- No `any` in `src/lib/casino/`.
- A malformed log in a fixture causes the hook to error, not silently succeed.

---

### 6. Cross-validate chain in `/api/search`

**Context.** `src/app/api/search/route.ts` reads `chainId` from the cookie via `getSportsChainId()`. UI cross-checks with the wallet, but the API route trusts the cookie alone — a stale cookie returns off-chain results.

**Ask.**
- Validate the cookie value against `SPORTS_CHAIN_IDS` at request entry; on mismatch, fall back to the default chain and set a corrective `Set-Cookie`.
- Optionally accept a `?chain=` query override (already in URL paths) as the source of truth.

**Files.** `src/app/api/search/route.ts`, `src/lib/sportsChainConstants.ts`.

**Acceptance.**
- Stale-cookie test returns results for the URL chain, not the cookie chain.
- Invalid cookie does not 500; it self-heals.

---

### 7. Provider stack — measure and fence re-renders

**Context.** `src/providers.tsx` stacks 8+ providers (Wagmi → QueryClient → OddsFormat → AzuroSDK → AzuroBetslip → Favorites → Toast → PendingBets → SettledBetsPrefetch). No prop-drilling, but a `PendingBetsProvider` invalidation can ripple to unrelated subtrees.

**Ask.**
- Add a React DevTools Profiler trace on the `/bets` page during a settle event; capture the render count of `Header`, `Sidebar`, `GameCard` instances.
- Where a provider's value changes per-second (e.g. countdown-derived state), split the value into `state` + `dispatch` contexts so consumers that only need `dispatch` don't re-render.
- Consider lifting `SettledBetsPrefetchProvider` *below* `LayoutChrome` so chrome doesn't re-render on prefetch progress.

**Files.** `src/providers.tsx`, `src/components/PendingBetsProvider.tsx`, `src/components/SettledBetsPrefetchProvider.tsx`, `src/components/LayoutChrome.tsx`.

**Acceptance.**
- Profiler trace committed to `docs/PERF_BASELINE_2026_04.md`.
- `Header` re-renders ≤2× per settled-bet event after the change (was 6+).

---

### 8. Reducer exhaustiveness in Betslip

**Context.** `src/components/Betslip.tsx:89–150` defines the action union manually; an unhandled action falls through to the default (no-op). New actions can be added without the reducer noticing.

**Ask.**
- Convert action union to a discriminated union with `kind` literal.
- Add an `assertNever(action)` default branch so missing cases fail typecheck.
- Add one reducer test per action arm.

**Files.** `src/components/Betslip.tsx`.

**Acceptance.**
- Removing a case arm causes typecheck to fail.

---

### 9. Pre-submit bet summary strip in Betslip

**Context.** Today, the Betslip submit button is the first place a user sees the combined total. Users have no single-line confirmation of "what am I about to do?" before they click.

**Ask.**
- Above the submit button, render a one-line summary: `{n} selections · ${stake} stake · {totalOdds} total odds · ${potentialPayout} to win`.
- Use `tabular-nums` (already in `globals.css`) for numeric alignment.
- Show this only when `canSubmit` is true; otherwise show the existing `disableReason` copy.

**Files.** `src/components/Betslip.tsx` (`BetslipStakeAndPlace`), reuse formatters from `src/lib/oddsFormat.ts`.

**Acceptance.**
- Single line of text appears above submit when slip is valid.
- Visual regression: existing `ConditionState` and odds-drift banners still render above this line.

---

### 10. Global pending-tx indicator in Header

**Context.** `Betslip.tsx` uses `useWaitForTransactionReceipt`, but there is no global affordance that says "you have 1 transaction in flight." Users who close the slip or navigate away lose the only signal that something is happening.

**Ask.**
- Add a `PendingTxIndicator` to `Header.tsx`, fed by `PendingBetsProvider` (sports) and the casino pending-bets store (`src/lib/casino/pendingBets.ts`).
- Render: spinning icon + count + tooltip listing chain + game/event titles.
- Click opens `MyBetsLink` destination.
- On settle, fold into `BetSettlementToasts` (already exists).

**Files.** `src/components/Header.tsx`, `src/components/PendingBetsIndicator.tsx` (likely already a starting point), `src/components/MobileLayoutChrome.tsx`.

**Acceptance.**
- Indicator visible across all routes while any tx is unconfirmed.
- Mobile bottom-nav variant present.

---

### 11. Empty states for bets, live, favorites

**Context.** No empty-state designs are wired for `/bets`, the live games list, or the favorites nav. Users with zero data see a blank pane and don't know if it's broken.

**Ask.**
- Build one `EmptyState` component (icon slot, headline, body, optional CTA).
- Wire into `/bets/page.tsx`, `LiveGamesList.tsx`, `FavoritesNav.tsx`, and `SportsList.tsx` for empty branches.
- Copy must distinguish "no data yet" from "no data on this filter"; provide a "Clear filters" CTA in the latter case.

**Files.** `src/components/EmptyState.tsx` (new), call sites above.

**Acceptance.**
- Each list renders the empty component when its source returns 0 items.
- Visual regression: non-empty render unchanged.

---

### 12. Distinct error templates by error class

**Context.** `RouteSegmentError.tsx` wraps a single `RetryCallout`; `error.tsx` files in `/bets`, `/casino`, `/app` all defer to it. Network errors, on-chain reverts, and user-input errors all look identical.

**Ask.**
- Extend `RetryCallout` with a `variant` prop: `network | onchain | input | unknown`.
- Map `userFacingTxError` (already exists in `src/lib/userFacingTxError.ts`) to the `onchain` variant.
- Variants get distinct icons + headline copy ("Network problem" vs "Transaction failed" vs "Check your input").
- Retry button only renders for `network | unknown`; on-chain reverts get a "View on explorer" link instead.

**Files.** `src/components/RetryCallout.tsx`, `src/components/RouteSegmentError.tsx`, `src/lib/userFacingTxError.ts`.

**Acceptance.**
- `/bets` `error.tsx` renders the on-chain variant for a simulated revert.
- Network failure shows the network variant with a working retry.

---

## P2 — Polish & long-tail

### 13. Stale-odds warning component

**Context.** `src/components/GameCard.tsx:296` shows stale-odds copy as raw red text. Inconsistent with the rest of the toast/callout system.

**Ask.**
- Build `StaleOddsAlert` matching the amber `AzuroWrongChainCallout` style (icon, body, CTA: "Open game").
- Replace the raw text in `GameCard` and any other call sites.

**Files.** `src/components/StaleOddsAlert.tsx` (new), `src/components/GameCard.tsx`.

**Acceptance.**
- No raw `text-red-*` warning text in `GameCard.tsx`.

---

### 14. Odds-button typography & disabled-state contrast

**Context.** Odds button labels are `text-xs` (12px); disabled state is `opacity-50` over `bg-zinc-800/40`, which fails AA contrast.

**Ask.**
- Bump label to `text-sm` (14px) on desktop, keep `text-xs` only when there are 5+ outcomes in a row.
- Disabled state: replace `opacity-50` with explicit `text-zinc-500` on `bg-zinc-900` to maintain ≥4.5:1 contrast.

**Files.** `src/components/OddsButton.tsx`, `src/app/globals.css` if a new utility class is needed.

**Acceptance.**
- Lighthouse accessibility score for `/[chain]/sports/[slug]` does not regress; contrast checks pass.

---

### 15. Light mode (or explicit "dark only" stance)

**Context.** `globals.css` is dark-only with no `prefers-color-scheme: light` branch. For an app with disabled/inactive states, this hurts outdoor and accessibility use.

**Ask.** Pick one:
- **A.** Add a light-theme branch using CSS custom properties; toggle via `Header` + persist via cookie. ~1 week of design+impl.
- **B.** Decide officially "dark only", document in `globals.css`, and remove `dark:` Tailwind variants where they exist as dead code.

Recommendation: **B for now, A in a follow-up cycle** unless product owner pushes light mode forward.

**Files.** `src/app/globals.css`, plus chosen scope.

**Acceptance.** Decision recorded in `docs/`; if A, the toggle works on every route.

---

### 16. Visual market grouping in `GameDetailMarkets`

**Context.** All odds buttons look identical regardless of market type (moneyline vs spread vs total). On a busy event, this creates a wall of buttons.

**Ask.**
- In `MarketGroup.tsx`, render a small chip-style header per market type (already grouped in data; just needs visual treatment).
- Add expand/collapse per group; persist last-collapsed state in `sessionStorage` keyed by sport.

**Files.** `src/components/MarketGroup.tsx`, `src/components/GameDetailMarkets.tsx`.

**Acceptance.**
- Football match detail collapses cleanly; mobile remains scrollable.

---

### 17. Casino VRF-wait progress UI

**Context.** Casino games (`CoinTossGame.tsx`, `DiceGame.tsx`, etc.) have `waitingVrf` and `vrfSoftTimeout` states but no visible progress affordance during the wait. Users see a static animation frame and assume the game hung.

**Ask.**
- Build a `VrfProgressIndicator` component: indeterminate progress bar + copy ("Waiting for randomness — usually under 30 seconds") + escalation message at `vrfSoftTimeout`.
- Wire into all six casino games.

**Files.** `src/components/VrfProgressIndicator.tsx` (new), `src/components/{CoinToss,Dice,Keno,Plinko,Roulette,Wheel}Game.tsx`.

**Acceptance.**
- VRF wait shows progress + copy; soft-timeout shows "Still waiting — your bet is safe; try refreshing in a moment."

---

### 18. Contract source ↔ bytecode parity

**Context.** Bytecode lives at `contracts/*-bytecode.txt`; Solidity source lives in subfolders. There is no build step in `package.json` linking them. Source could change without bytecode following.

**Ask.**
- Add a `contracts/build.sh` (or `npm run build:contracts`) that compiles each source folder via solc and writes the bytecode with a deterministic header (`// compiled from <commit-sha>`).
- CI step: re-run the build and diff against committed bytecode; fail if drift.

**Files.** `contracts/build.sh` (new), `package.json`, `.github/workflows/*` if CI exists.

**Acceptance.**
- `npm run build:contracts` regenerates bytecode bit-for-bit identically.
- CI fails on drift.

---

### 19. Casino kill-switch metadata cleanup

**Context.** Middleware redirects `/casino` when `NEXT_PUBLIC_CASINO_ENABLED !== "true"`, but cached OG images, sitemap, and robots may still reference casino routes when the flag flips.

**Ask.**
- `src/app/sitemap.ts` and `src/app/robots.ts` should already respect the flag; verify and add an inline comment.
- Add a `docs/CASINO_KILL_SWITCH.md` runbook covering flag flip + Vercel cache purge + crawler revalidation.

**Files.** `src/app/sitemap.ts`, `src/app/robots.ts`, `docs/CASINO_KILL_SWITCH.md` (new).

**Acceptance.**
- Disabling the flag and redeploying produces a sitemap with zero `/casino*` URLs.

---

### 20. Legal pages — counsel sign-off + content

**Context.** `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` are placeholders. Footer links exist; no test verifies content presence.

**Ask.**
- Engage counsel; replace placeholders with reviewed copy.
- Add a smoke test that asserts each page renders >2KB of text and contains required sections (Privacy: data categories, contact; Terms: jurisdiction, age gate, disputes).

**Files.** `src/app/{terms,privacy}/page.tsx`, `scripts/smoke-production.mjs`.

**Acceptance.**
- Smoke test fails until placeholder text is replaced.
- Counsel sign-off recorded in `docs/`.

---

### 21. Re-assess and write the next PRD

**Context.** This PRD is a snapshot of the codebase as of 2026-04-24. Once items 1–20 land, the surface area shifts: new code introduces new debt, fixed items reveal next-layer issues, and product priorities will have moved. A standing follow-up step keeps the assessment cycle alive instead of letting it ossify into a one-off audit.

**Ask.**
- After items 1–20 are merged (or explicitly deferred), repeat the assessment: full technical pass + UI/UX pass on the current `master`.
- Compare against this PRD: what landed, what slipped, what changed scope, what surfaced new.
- Write `docs/PRD_ASSESSMENT_<YYYY_MM_DD>.md` in this same format (P0/P1/P2, context/ask/files/acceptance, sequencing table, "how findings were gathered").
- Then **execute on the new PRD** — do not stop at the document. Schedule the work into sprints and start P0 the same week.

**Files.** New `docs/PRD_ASSESSMENT_<YYYY_MM_DD>.md`; updates across `src/` driven by that PRD.

**Acceptance.**
- New PRD exists in `docs/` and is dated.
- Each item from this PRD is accounted for in the new one (landed / deferred / superseded), with a one-line note.
- At least the P0 items from the new PRD have either landed or are in active PRs within one sprint of the new PRD's date.

---

## Out of scope (intentional)

- **Light mode full rollout** — covered as a P2 decision, not committed.
- **Casino game redesign** — flows differ from sports by nature; not a defect.
- **Solidity audit** — required before mainnet but tracked separately from this PRD.
- **Localisation** — not requested; English-only acceptable for current jurisdictions.

---

## Suggested sequencing

| Sprint | Items |
|--------|-------|
| 1 (now) | 1, 2, 4 — type safety + error visibility + secret hygiene |
| 2 | 3, 5, 8 — testing net under critical paths + reducer rigor |
| 3 | 6, 7, 11, 12 — API correctness + provider perf + empty/error UX |
| 4 | 9, 10, 13, 14 — pre-submit confidence + tx visibility + odds polish |
| 5 | 15, 16, 17 — theme decision, market grouping, VRF UX |
| Pre-mainnet | 18, 19, 20 — bytecode parity, kill-switch, legal |
| After 1–20 | 21 — re-assess, write the next PRD, execute on it |

---

## How findings were gathered

- Static read of `src/`, `contracts/`, `docs/`, `package.json`, `tsconfig.json`, `middleware.ts`, `globals.css`.
- No runtime profiling; performance items are based on code inspection and should be confirmed with a Profiler trace (item 7).
- No security audit; items 1, 2, 4, 6 are code-level smells, not penetration testing.
- UI/UX items inferred from JSX + Tailwind classes + design tokens; not from a live browser session.
