# EliesBets — Follow-up PRD (2026-04-21)

Working state:
- Branch: `master`
- Last pushed commit: `9b9f1aa feat: odds drift UX, list condition state, claims and bets polish`
- **Uncommitted local edits** (typecheck passes; not yet on Vercel):
  - `src/app/bets/page.tsx` — auto-prefetch all settled `useBets` pages, pass `claimableSlipTotal` to header.
  - `src/components/BetsSummaryStrip.tsx` — **To claim** = `max(indexerToPayout, sum(claimable slip payout))`, never negative, up to 4dp.
  - `src/components/Betslip.tsx` — richer `ConditionState` copy (market paused vs odds drift).
  - `src/lib/azuroClaimEligibility.ts` — new `sumClaimableExpectedPayout`.
  - `src/lib/useCountdown.ts` — guard football match minute against Unix-epoch `clock_tm` (`>300` → fallback).

This PRD is for whoever picks this up next. Each item has **context, acceptance criteria, and pointers**. Nothing here is a hypothetical; every item is a real bug or debt found in the code or reported by users.

---

## 1. Odds-change “accept” UX — replace `window.confirm` with in-app modal

**Context.** `src/components/Betslip.tsx` detects any real slip→live price drift (`oddsDriftedFromStored` in `src/lib/oddsFormat.ts`), shows an amber “Odds updated” strip, then on **Place Bet** calls `window.confirm(...)` (line ~873). Browser confirm is ugly on desktop, feels broken on mobile, not accessible.

**Ask.** Replace with an in-slip confirmation step:

- Small dialog or inline block with two primary actions: **Place at new prices** (submits) and **Cancel**.
- Lists each changed leg (old → new decimal, plus the user’s current odds format) and combined total when combo.
- Should trap focus, ESC closes, `role="dialog"`, labelled by the banner heading.
- Still gated by `canSubmit` (stake valid, `isBetAllowed`, not busy).

**Files.** `src/components/Betslip.tsx` (`BetslipStakeAndPlace`), can reuse patterns from `src/components/AzuroWrongChainCallout.tsx` or new `components/ConfirmOddsChangeDialog.tsx`.

**Acceptance.**
- No `window.confirm` anywhere in `src/`.
- Keyboard users can confirm or cancel without a mouse.
- Visual regression: current amber banner still appears while dialog closed.

---

## 2. “Market paused/closed” vs “Checking market availability…”

**Context.** In `Betslip.tsx` (`sdkDisableMessage`) we now soften `ConditionState` to “Checking market availability…” while `isOddsFetching || isBetCalculationFetching`. But a legitimately paused condition can also refetch frequently, so users may see the soft message forever and never realize the line is dead.

Users also report clicking seemingly random prematch games (Dota, etc.) and getting the same yellow banner on legs that still show odds elsewhere.

**Ask.**

1. Add a **grace window** (e.g. `800ms`) before downgrading the message. After the grace window, show the full paused copy even if `isOddsFetching` is still true. Implementation: track `lastConditionStateAt` with `useRef`, compare to `Date.now()` on render.
2. **Investigate root cause** for prematch false positives: is `useDetailedBetslip().disableReason` returning `ConditionState` because the condition cached from `GameCard`/`LiveGameCard` lags the one the Betslip fetches?
   - Add a **dev-only** log (behind `NEXT_PUBLIC_CLAIM_DEBUG`-style flag, e.g. `NEXT_PUBLIC_BETSLIP_DEBUG=1`) that records `{conditionId, outcomeId, stateFromList, stateFromDetailedSlip, disableReason}` when the banner appears.
3. Optional **auto-heal**: when `ConditionState` persists >3s for a selection, surface a compact **Remove** affordance inline in the banner (in addition to the slip’s per-leg remove) so users don’t hunt.

**Acceptance.**
- Soft message never shows for more than ~1s if the SDK stays in `ConditionState`.
- Known false-positive repro from reporter disappears, or we have a captured log proving it is SDK-side.

---

## 3. `BetsSummaryStrip` — trustworthy “To claim” during prefetch

**Context.** `src/app/bets/page.tsx` now walks every settled page (up to 100) on mount and feeds `claimableSlipTotal` to `BetsSummaryStrip`. The strip shows `max(indexer, slip)` and a small note when slip wins. But while prefetching:

- The headline may jump up as pages load (good), but there is **no loading indicator** to explain why the number moves.
- On users with 300+ settled bets, this is 10–15+ requests per mount, with no caching signal to the user.
- Cap is hard-coded to 100 pages; we do not surface that the cap hit.

**Ask.**

1. Thread a `isPrefetchingSettledPages` boolean from `bets/page.tsx` into `BetsSummaryStrip`. Render a subtle `…` next to the value (not the whole cell) while prefetching; keep the already-shown number visible so it does not flash to `0`.
2. Extract the 100 constant to `const MAX_SETTLED_PREFETCH_PAGES = 100` with a `console.warn` (dev-only) if it hits the ceiling.
3. Debounce prefetch: only kick off once per wallet/chain combo per session (`sessionStorage` key `eliesbets:prefetchedSettled:{address}:{chainId}`). Refetch on `onDone` (after claim) is still explicit.

**Acceptance.**
- No prefetch storm on tab switch or unrelated renders.
- Strip never flickers between `0.00` and the real total.
- Prefetch cap is visible in code as a named constant.

---

## 4. Claim all — per-bet progress & mismatch visibility

**Context.** `ClaimAllBetsButton.tsx` already batches redeem by `(LP, core, freebet, paymaster)` and bisects on wallet fee-cap errors. But from the user side:

- When `summary.toPayout > 0` but no claimable rows exist on loaded pages, the toast says “your summary still shows unclaimed funds, but no redeemable wins were found…”. This is a terminal state message, not an actionable one. Users do not know whether to wait, refresh, or something else.
- During sequential redeem across multiple batches there’s no per-batch status.

**Ask.**

1. When we detect **summary>0 but 0 claimable after full prefetch**, offer a single **Retry / refetch subgraph** action (wraps `refetchSettled` + `refetchBetsSummary`) and a second **Report** action that copies the relevant `claimBetDebugSlice` list to clipboard.
2. Track `batchesDone / batchesTotal` during sequential redeem and show on the button (e.g. `Claiming 2/5…`).
3. On failure of one batch, show a toast with count of **succeeded** vs **remaining**, not just the viem error.

**Acceptance.**
- No “no redeemable wins found. Refresh the page or wait.” without an in-UI action.
- While claiming, the button label changes as batches finish.

---

## 5. Live badge — extend epoch guard to basketball & other sports

**Context.** `src/lib/useCountdown.ts` now rejects Unix-epoch values in `clock_tm` for football. But `formatLiveBadgeTimer` still trusts `scoreBoard.time` straight through for basketball (and any sport through its fallback). Same upstream feed quirks can surface.

**Ask.**

1. Generalise the epoch guard: any numeric-only token over `10_000` (or equal to `parseInt(startsAt) * 1000` within tolerance) is rejected.
2. Unit tests for `formatLiveBadgeTimer` covering: `clock_tm=1776805123440`, `scoreBoard.time=90+2`, basketball Q2 `12:34`, unknown sport fallback.

**Files.** `src/lib/useCountdown.ts`, new `src/lib/__tests__/useCountdown.test.ts` (Vitest — see §9).

**Acceptance.**
- No screenshot with `…'` where `…` is >300.
- Test matrix green.

---

## 6. `GameCard` “inactive” guard — verify list-vs-detail condition identity

**Context.** `GameCard` now disables odds buttons when `line.conditionState !== Active` (good, aligns with `MarketGroup`). But `TopOddsLine` is built at list fetch time (`fetchTopOddsByGameId`), and the user still clicks and sees the Betslip yellow. Either:

- The list data ages (no revalidate on focus, card state stale), OR
- The Betslip checks a **different** condition than the one on the card (market rotation, new line).

**Ask.**

1. Add a `fetchedAt` timestamp to `GameOddsData` in `src/lib/oddsUtils.ts`.
2. In `GameCard`, if `Date.now() - fetchedAt > 30s`, replace the list card odds with a skeleton + subtle “refreshing” badge; block add until re-validated (quick `useActiveConditions` for that game, as `LiveGameCard` does — but only when user hovers/taps a stale card).
3. Log (dev) when the Betslip disables a selection that the card thought was active.

**Acceptance.**
- User report pattern (prematch game, click outcome, yellow banner) reproduces less or captures a log for handoff.

---

## 7. Wagmi hook inconsistency

**Context.**

- `useConnection` in 13 files (correct per `docs/CLAUDE_REVIEW_SPORTS_CHAIN.md`).
- `useAccount` in `src/components/Betslip.tsx` (line 432) and every casino component.

Mixed usage is a footgun: the two return slightly different shapes on different wagmi versions.

**Ask.** Replace all `useAccount` with `useConnection` for address/isConnected reads, unless an API used requires `useAccount` (Betslip currently uses just `address` + `isConnected`, so safe to swap).

**Acceptance.** Grep `useAccount` only shows imports where `connector` or another `useAccount`-specific field is used, if any.

---

## 8. Deduplicate `formatStartTime`

**Context.** Identical function in `src/components/GameCard.tsx:36` and `src/components/BetCard.tsx:36`. Same small seconds-vs-ms heuristic. Easy duplication to drift.

**Ask.** Move to `src/lib/useCountdown.ts` (next to `parseStartsAtMs`). Export `formatStartTime(startsAt: string, opts?: Intl.DateTimeFormatOptions)`. Replace both usages.

**Acceptance.** Single implementation, same UI output.

---

## 9. Minimum test coverage for money-adjacent logic

**Context.** Zero automated tests cover the functions that decide **claims** and **bet placement math**. Every regression lands in production.

**Ask.** Add **Vitest** (aligns with Next 16 ecosystem). Tests for, at minimum:

- `betIsClaimable` — won/lost/canceled/rejected/redeemed/edge (`isRedeemable && resolvedAt && possibleWin>0` fallback).
- `sumClaimableExpectedPayout` — prefers `payout` over `possibleWin`, skips non-claimable.
- `oddsDriftedFromStored` — exact equal, 1e-9 noise, 0.01 move, invalid inputs.
- `formatDriftDecimalPair` — 2dp, 4dp fallback.
- `formatFootballLiveMinute` — epoch rejection, `45+2`, empty.
- `formatLiveBadgeTimer` — matrix from §5.

**Acceptance.** `npm run test` runs these; CI (or at least `scripts/verify-linux.sh`) invokes them.

---

## 10. Error surface audit

**Context.** `formatUserFacingTxError` handles Rabby fee-cap, user-reject, wrong-chain. A few likely holes in production:

- MetaMask mobile “user rejected” has a different code path than desktop.
- Insufficient funds on paymaster vs EOA.
- Rate-limited RPC (`429` wrapped in viem `InternalRpcError`).

**Ask.** Add a dev affordance (`NEXT_PUBLIC_TX_DEBUG=1`) that prints the raw viem error shape when `formatUserFacingTxError` falls to the generic branch, so QA can report real-world messages. Curate a short table of known error shapes in `src/lib/userFacingTxError.ts`.

**Acceptance.** On a 10-error QA session, no more than 1 falls through to the generic message.

---

## 11. A11y & polish micro-items (batch together)

- Odds drift banner uses `role="status"` — fine. But the detail (`oddsDrift.summary`) lives inline with the banner and may be skipped by screen readers. Add `aria-live="polite"` to the strip container when it appears.
- Claim all tooltip text is rich; mirror into a visible `<p>` under the button on md+.
- Ensure all interactive odds buttons have `aria-label` including the market label + price, not just the price.
- `MobileBetslipDrawer` trap: verify Escape closes it and focus returns to the opener.

---

## Out of scope for this PRD

- Casino section refactor (`useAccount` sweep excluded from §7 for casino unless trivial).
- Azuro SDK version bumps — only if a listed issue is resolved upstream.
- Bet sharing / Open Graph unless a bug is filed.

---

## Suggested order

1. **§1 Odds modal** — user-visible win, unblocks §2.
2. **§2 ConditionState grace + log** — solves the loudest complaint.
3. **§3 To-claim prefetch UX** — clarifies the 7.17 vs 7.32 confusion for good.
4. **§4 Claim all progress** — visibility during longer sessions.
5. **§5 Live badge** + **§9 tests** — small, lock behaviour.
6. Everything else.

---

## Pointers

- Last human-reported bugs (screenshots, 2026-04-21 evening): live timer `1776805123440'`, prematch yellow banner on random games, `To claim` 7.17 vs wallet +7.32, `To claim` dipping to −0.15 after claim.
- Latest session commits/changes summarised at the top.
- Bridge to Linux `dev@37.27.67.102:/home/dev/EliesBets` for build/Claude Code reviews (see `.cursor/rules/openclaw-claude-code-ship-loop.mdc`).

---

# Extension — second audit pass (2026-04-21, code-wide sweep)

Items below came out of a full read of `src/` (app routes, components, lib, middleware, casino hooks). They are **not** blocking the current fixes; they describe debt, correctness risks, and UX polish that a follow-up model can pick up without context from this session.

Format matches the items above: **Context → Ask → Acceptance**, with file pointers.

---

## 12. Drift detection stores rounded-to-2dp odds (false positives on live)

**Context.** In `src/components/GameCard.tsx:95` and `src/components/MarketGroup.tsx:40` the slip selection is written with:

```ts
odds: line.odds.toFixed(2)
```

That string is later parsed back with `parseStoredDecimalOdds` and compared to the live SDK price via `oddsDriftedFromStored` (scale `1e6`). When the backend gave e.g. `2.105`, we **lock** the slip at `"2.10"`, then the very next SDK tick reports `2.105` again and `oddsDriftedFromStored(2.10, 2.105)` → **true**. Result: the amber “Odds updated” banner shows up on most live games the instant the user lands on the slip, even when nothing actually moved.

This directly worsens §1 (odds confirm UX) and the user complaint “we keep getting this annoying yellow thing…on live”.

**Ask.**

1. Stop rounding at add-to-slip time. Persist the full-precision decimal the SDK gave us (still as a string for React state — `String(line.odds)` or `line.odds.toFixed(6)` with a note on why 6dp).
2. Only apply display rounding in `formatStoredOddsString` / `formatDecimalOddsValue` — they already do.
3. Drop the `"—"` early-return in `parseStoredDecimalOdds` **only** if we continue to tolerate display placeholder strings; otherwise keep it.
4. Re-test: `OddsButton.onClick → Betslip open → immediate next poll` must **not** show the drift banner when the live price is unchanged.

**Acceptance.**
- Manual test (3 different live soccer games): add pick, wait 30 s. No amber banner if the live price is stable to 6dp.
- Drift banner still fires when an actual move happens (even 0.001).

**Files.** `src/components/GameCard.tsx`, `src/components/MarketGroup.tsx`, `src/lib/oddsFormat.ts`, `src/components/Betslip.tsx` (indirectly — already parses with `parseStoredDecimalOdds`).

---

## 13. Rename & narrow `formatUserFacingTxError`

**Context.** `src/lib/userFacingTxError.ts` is the **only** error-to-message helper in the app. It is used in:

- Wallet / tx paths (correct): `Betslip.tsx`, `CashoutButton.tsx`, `ClaimAllBetsButton.tsx`, `BetCard.tsx`, `Header.tsx`, `ConnectModal.tsx`, casino components.
- Non-tx / server-fetch paths (semantically wrong): `HomePageSections.tsx` (server), `SearchBar.tsx` (fetch error), `SportsChainSync.tsx` indirectly.

The function name promises transaction-error translation but its branches cover wallet-only situations (user rejected, chain not configured, fee cap). A graph fetch failure falls through to the very last branch (`raw.slice(0,400)`), which means users see raw subgraph error text on the home page.

**Ask.**

1. Split into two helpers:
   - `formatWalletTxError(e)` — current contents.
   - `formatServerFetchError(e)` — neutral copy (“Could not reach the games feed. Try again in a moment.”) with a tiny allowlist of cases (429, AbortError, network offline).
2. Update all call sites.
3. Keep a back-compat `formatUserFacingTxError = formatWalletTxError` export for one release, with a JSDoc `@deprecated` pointing to the replacements.

**Acceptance.** No server-component path imports `formatUserFacingTxError`. RSC fetch failures render generic copy, not a 400-char stack.

**Files.** `src/lib/userFacingTxError.ts` → add sibling file, migrate call sites.

---

## 14. `revalidate = 45` on home/sport pages is silently disabled by cookie read

**Context.** `src/app/page.tsx:16` sets `export const revalidate = 45;` but the page tree calls `await getSportsChainId()` which does `await cookies()` in `src/lib/sportsChain.ts`. Next marks any route that reads cookies as **dynamic**; the ISR directive becomes a no-op. Same pattern in `src/app/sports/[slug]/page.tsx:10`.

Effect: every home / sport hit round-trips to the subgraph. On Vercel that is fine-ish but wasteful; it defeats the optimisation intent expressed in the code.

**Ask.** Either:

- **Option A (keep dynamic).** Delete `export const revalidate = 45;` from home and `sports/[slug]/page.tsx`. Leave a comment explaining cookie-driven dynamic.
- **Option B (cache properly).** Refactor `getSportsChainId` into a pure function that takes `chainId` from a **middleware-injected header** (or a URL segment) instead of a cookie. Then `revalidate` or `fetch({ next: { tags: ["home"] } })` can actually kick in, keyed per chain.

Option A is fine for now. Document the decision in code.

**Acceptance.** No dead `revalidate` constants. Lighthouse TTFB unchanged or better.

**Files.** `src/app/page.tsx`, `src/app/sports/[slug]/page.tsx`, possibly `src/lib/sportsChain.ts`.

---

## 15. Middleware rate limit is per-edge-instance and CSP has `style-src 'unsafe-inline'`

**Context.** `src/middleware.ts`:

- `hitsByIp` is an in-memory `Map`. On Vercel Edge each region/instance has its own map, and the same IP can fan out across replicas, so effective `RATE_LIMIT_MAX=30/min` is really `30 × instances`. It still slows trivial floods but is not a real control.
- CSP uses `style-src 'self' 'unsafe-inline'`. This is required for Tailwind arbitrary values, but we should either drop it (if possible with a nonce on `<style>`) or explicitly document it.
- `connect-src 'self' https: wss:` is essentially wide-open for https; acceptable given wagmi RPC variety, but worth noting.

**Ask.**

1. Move the search rate-limiter to Vercel KV / Upstash Redis (or accept the current behaviour and add a doc comment near the `hitsByIp` declaration).
2. Add a comment in the CSP block explaining `style-src 'unsafe-inline'` (Tailwind v4 inline arbitrary values).
3. Optional: add a `NEXT_PUBLIC_RP_ID` / production-only origin allowlist to `frame-ancestors` if embedding is ever needed.

**Acceptance.** No silent drift. Either real distributed rate-limit, or an explicit code comment saying “best-effort only”.

**Files.** `src/middleware.ts`.

---

## 16. `/api/search` — error message loss, no CDN cache, no minimum-keystroke contract

**Context.** `src/app/api/search/route.ts`:

- `} catch { return Response.json({ error: "Search failed" }, ... )` — throws away the real cause. When the subgraph is down we can’t tell from the logs what happened; `SearchBar` then runs the swallowed message through `formatUserFacingTxError` (which maps to “Network request failed…”).
- No `Cache-Control` / `revalidate` — every keystroke ≥3 chars hits the route handler.
- `perPage: 25` + `page: 1` hardcoded; no abort support server-side.

**Ask.**

1. Log the real error server-side (`console.error(e)`) and include a stable `code` in the response (`"search_failed"`) so the client can localize.
2. Add `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` when the result is non-empty. Keystrokes through the same prefix within 10 s share a cached response.
3. Validate `q` length (`< 3 || > 64`) returns `200 { games: [] }` without hitting the SDK (already partially done).
4. Accept an `AbortSignal` via `request.signal` when upstream supports it.

**Acceptance.**
- `curl /api/search?q=liver` twice in 5 s → second response served from the CDN (visible in `x-vercel-cache`).
- Server logs show the actual upstream error on failure.

**Files.** `src/app/api/search/route.ts`.

---

## 17. `PendingBetsProvider` polls full event window every 5 s per pending bet

**Context.** `src/components/PendingBetsProvider.tsx` watchdog uses `getContractEvents(..., { fromBlock: bet.blockNumber ?? head-2000, toBlock: head })` every 5 s for every non-resolved pending casino bet. Each tick re-scans the entire range — no per-bet `lastCheckedBlock` cursor. On Base (2 k block cap, block time ~2 s) this means each 5 s tick re-reads ~2 000 blocks worth of logs for each pending row.

Also: `bet.blockNumber` is stored as a `string` that converts to `bigint`. If `markBlock` never fires (e.g. wallet restarts before receipt) the fallback is `head - 2_000n` → 5 s polling of the last hour of blocks forever.

**Ask.**

1. Track `lastCheckedBlock` in the pending bet record. On each tick, use `fromBlock = Math.max(bet.blockNumber, lastCheckedBlock+1)`. Persist along with the rest of the bet in localStorage.
2. Stop polling a bet after N failed ticks or > `STALL_AFTER_MS * 4`; leave it in the list marked `stalled` but not polled.
3. Unit test the cursor advancement so we don’t accidentally regress to “rescan the same 2 k blocks forever”.

**Acceptance.** Network panel shows one `eth_getLogs` per tick per bet, with a shrinking range over time.

**Files.** `src/components/PendingBetsProvider.tsx`, `src/lib/casino/pendingBets.ts` (types).

---

## 18. Two providers auto-paginate the same settled-bets query

**Context.**

- `src/components/BetSettlementToasts.tsx` walks up to `MAX_SETTLEMENT_TOAST_PAGES = 30` on mount for `type: Settled`.
- `src/app/bets/page.tsx` (uncommitted edit) walks up to 100 on mount for the same filter.

Both read the same TanStack key. Requests **should** dedupe, but the effects are independent, racing to call `fetchNextPage`, potentially updating the same TanStack state from two places and triggering re-renders on every page boundary. On accounts with hundreds of settled bets this kicks off a storm even when the user never opens `/bets`.

**Ask.**

1. Hoist the “full settled history loaded” behaviour into a single provider (e.g. `SettledBetsProvider`) that:
   - Runs one `fetchNextPage` loop guarded by `sessionStorage` (see §3).
   - Exposes `isComplete` and the merged array.
2. `BetSettlementToasts` and `/bets` consume the provider rather than calling `useBets` independently.
3. Alternative: put the settlement-toast logic behind an explicit user action (“get notified”) instead of an always-on crawl.

**Acceptance.** Wallet with 200+ settled bets: on cold load of `/` the network tab shows `useBets` paging from a single initiator.

**Files.** `src/components/BetSettlementToasts.tsx`, `src/app/bets/page.tsx`, new `src/components/SettledBetsProvider.tsx`.

---

## 19. Casino hooks — massive duplication across 5 games

**Context.** `src/lib/casino/hooks.ts` is 2 300+ lines. `useCoinToss`, `useDice`, `useRoulette`, `useKeno` all re-implement the same scaffolding (VRF poll, `betHistory` local-storage parse/serialize/merge, `loadFromChain` via `getContractEventsChunked`, `useWatchContractEvent` + persist, `placeWager` with approve + VRF budget). `useWheel` and `usePlinko` already share `useWeightedWheelLikeGame`.

Symptoms of this: bugs fixed in one game get forgotten in the others (e.g. VRF fallback numbers are hardcoded per chain in a single `MIN_VRF_BUDGET_BY_CHAIN`, but every hook duplicates the `vrf * 200/100 ?: getMinVrfBudget()` formula; a fix has to be applied in 5 places).

**Ask.**

1. Extract `useRollHistory<RollResultT>({ contract, abi, parse, merge, serialize, storageKeyFn })` covering: cold load, chunked refetch, subscribe, persist.
2. Extract `useVrfCostPoll({ contract, abi, token, betCount? })` — replaces the 4× copy-pasted block.
3. Extract `placeWagerBase({ contract, abi, functionName, args, token, vrfCost, connected, publicClient, chainId })` that handles approve and `msgValue`.
4. Keep game-specific only: `encodedNumbers`, `cap`, `face` inversion, decoded-log → domain object.

**Acceptance.** `hooks.ts` drops to ~800 LOC. Same functionality in `/casino/*` pages. No regressions in coinToss / dice / roulette / keno pending lists.

**Files.** `src/lib/casino/hooks.ts` (split into `useRollHistory.ts`, `useVrfCostPoll.ts`, `useGenericWager.ts`).

---

## 20. Casino `timestamp` semantics mix block-sort-key and Unix ms

**Context.** In `src/lib/casino/hooks.ts`, `rollFromDecodedLog` (and all sibling `*RollFromDecodedLog` functions) build a `RollResult.timestamp` from:

```ts
timestamp: Number(rollSortKeyFromLog(log))  // blockNumber * 1e6 + logIndex
```

That is not a Unix timestamp. Meanwhile `useWatchContractEvent.onLogs` builds new rows with:

```ts
timestamp: Date.now()
```

Merging via `r.timestamp >= prev.timestamp` still works because real timestamps are always bigger than the block-sort key (for any post-1970 chain), but:

- The field name lies. Any future code that does `new Date(roll.timestamp)` shows 1970 for historical rows and today for live rows.
- Sort order is “historical rows first by block, then live rows by wallclock”, which is close but not strictly correct.

**Ask.**

1. Split into two fields: `sortKey` (block × 1e6 + logIndex, used only for merge/sort) and `receivedAt` (Unix ms, optional).
2. Update `parseStored*BetHistory` / `serialize*BetHistory` to include both, tolerating missing `receivedAt` on old rows (back-fill from block if available).
3. UI that displays relative time (BetCard et al.) uses `receivedAt ?? null` and falls back to “just now / recent”.

**Acceptance.** No `new Date(roll.timestamp)` rendering “Jan 01 1970”. Merge/sort matches current behaviour.

**Files.** `src/lib/casino/hooks.ts`, wherever history rows are rendered.

---

## 21. `rollCountRef` is dead state across every casino game

**Context.** Every casino hook allocates a `rollCountRef = useRef(0)` and increments it in `onLogs`. The value is never read or returned from the hook. Zero functional purpose.

**Ask.** Remove it from `useCoinToss`, `useDice`, `useRoulette`, `useKeno`, `useWeightedWheelLikeGame`. Verify no downstream file reads it.

**Acceptance.** Grep `rollCountRef` yields no hits.

**Files.** `src/lib/casino/hooks.ts`.

---

## 22. Server-side error messages leak raw upstream text

**Context.** `src/app/live/page.tsx:50`, `src/app/sports/[slug]/page.tsx:64`, `src/app/sports/[slug]/[country]/page.tsx`, `src/app/sports/[slug]/[country]/[league]/page.tsx`, and `src/app/games/[id]/page.tsx:141,166` all do:

```ts
loadError = e instanceof Error ? e.message : "Failed to load ..."
```

That pipes raw subgraph / fetch errors (which sometimes include URLs, IDs, or stack traces) into the `RetryCallout` shown to users.

**Ask.**

1. After §13, import `formatServerFetchError` and pass all caught errors through it.
2. Add a dev-only `console.error(e)` in the catch block so logs still retain the real cause.

**Acceptance.** User-facing `RetryCallout` description never exceeds a curated list of short copy lines; raw errors only in server logs.

**Files.** All server route files listed above.

---

## 23. Sitemap hardcodes a single chain

**Context.** `src/app/sitemap.ts:7` pins the sitemap to `DEFAULT_SPORTS_CHAIN_ID` (Polygon). Games listed exclusively on Gnosis or Base are invisible to search engines. Given that games are chain-scoped on Azuro, this is a real content omission for multi-chain users.

**Ask.**

1. Extend sitemap generation to fan out over `HEADER_SWITCHER_CHAIN_IDS` and **dedupe** by (sport slug, country slug, league slug, game id).
2. Keep a `?chain=polygon` / path-based disambiguation if the routed pages need chain context.

**Acceptance.** `curl /sitemap.xml | grep gnosis-only-league` → returns entries.

**Files.** `src/app/sitemap.ts`, possibly route patterns under `src/app/sports/`.

---

## 24. `extractMainLineOdds` regex is English-only

**Context.** `src/lib/oddsUtils.ts:45`:

```ts
const matchWinner = markets.find((m) => /match winner/i.test(m.name));
```

Works today because the toolkit returns English strings. The moment Azuro ships a localized market name (or a different casing like “Match-Winner”), the fallback drops to “first non-OU market”, which may be Handicap or BTTS — surfacing the wrong prices on the card.

**Ask.**

1. Prefer `marketKey` family matching over localized names. The fullTime branch (`"1-1-1"`) already does this; mirror for moneyline (`marketKey` prefixed `"19"`? verify with `FAMILY_LABEL`).
2. Keep the name regex only as last resort.

**Acceptance.** Same card output on every supported locale / SDK version.

**Files.** `src/lib/oddsUtils.ts`.

---

## 25. Per-card `useCountdown` causes 1 setState/sec per card

**Context.** `src/lib/useCountdown.ts` each mounted instance calls `setNow(Date.now())` via `setInterval(..., 1000)`. On `/` and `/sports/[slug]` we render dozens of `GameCard`s, each wrapping `PrematchCountdown`, each with its own interval. `LiveBadge` does the same.

On a 100-card page that’s 100 React renders per second driven by setState cascades. Not a prod-breaker, but likely visible in CPU profiles on cheap mobiles.

**Ask.**

1. Single global “clock” provider (`useGlobalSeconds()`) — `useSyncExternalStore` around a module-level `Date.now()` updated by one interval.
2. `useCountdown` consumes that tick instead of owning one.
3. `LiveBadge` similarly.

**Acceptance.** Perf profile on `/` drops from `N` intervals to 1 (`performance.now()` audit, or count with `console.log`).

**Files.** `src/lib/useCountdown.ts`, `src/components/LiveBadge.tsx`, add `src/lib/useGlobalSeconds.ts`.

---

## 26. `OddsButton` flash lifecycle allocates per-button timers

**Context.** Every `OddsButton` (tens on a page) maintains `prevOddsRef`, a per-button `requestAnimationFrame`, and a `setTimeout(FLASH_MS)`. Cleanup is correct, but the pattern is heavy for a UI effect that could be CSS-only. Also: because `prevOddsRef` updates on every `odds` change regardless of flash, the first render never sets `prev` → first real change doesn’t flash (minor UX gap).

**Ask.**

1. Replace with a keyed CSS animation: render the numeric value in a `<span key={odds}>` with a short Tailwind `animate-odds-up / animate-odds-down` class derived from `Math.sign(odds - prev)`. Let the browser animate.
2. Persist `prev` in a state `[prev, setPrev]` so React knows when to change the `key`.

**Acceptance.** Per-button overhead drops to a single prop change; visuals identical.

**Files.** `src/components/OddsButton.tsx`, Tailwind config (add keyframes).

---

## 27. `HomePopularUpcomingSections` never shows Over/Under line on cards

**Context.** `src/components/HomePageSections.tsx:247,283` pass `topOdds` to `GameCard` but **not** `overUnderOdds`, even though `TopOddsLine` supports it and `fetchTopOddsByGameId` could expose it cheaply. So the home page cards lack the second row that `LiveGameCard` shows. Likely accidental scope when we added O/U rendering.

**Ask.**

1. Extend `GameOddsData` in `src/lib/oddsUtils.ts` to include `overUnderOdds: TopOddsLine[] | null`.
2. Populate in `fetchTopOddsByGameId` using `extractOverUnderOdds`.
3. Thread through `HomePopularUpcomingSections` + `sports/[slug]/page.tsx` (same pattern).

**Acceptance.** Visual: popular/upcoming cards on `/` show the O/U row when the market exists for that game.

**Files.** `src/lib/oddsUtils.ts`, `src/components/HomePageSections.tsx`, `src/app/sports/[slug]/page.tsx`.

---

## 28. `parseStoredBetHistory` duplicated 5 times in casino hooks

**Context.** Each casino game has its own `parseStored*BetHistory` / `serialize*BetHistory` / `merge*ById` trio (`parseStoredBetHistory`, `parseStoredDiceBetHistory`, `parseStoredRouletteBetHistory`, `parseStoredKenoBetHistory`, `parseStoredWheelBetHistory`). Structure is identical except for which numeric fields get validated.

**Ask.** After §19, collapse into one generic helper:

```ts
function makeBetHistoryCodec<T>(schema: {
  decodeRow: (o: Record<string, unknown>) => T | null;
  encodeRow: (row: T) => Record<string, unknown>;
  sortTimestamp: (row: T) => number;
}): { parse(raw: string|null): T[]; serialize(rows: T[]): string; mergeById(...): T[] }
```

**Acceptance.** One parser per row shape. One spot for “bumped schema version → v2”.

**Files.** `src/lib/casino/hooks.ts`.

---

## 29. `fmtTokenAmount` in `BetsSummaryStrip` silently rounds sub-cent to `0.00`

**Context.** `BetsSummaryStrip` uses `fmtTokenAmount` (2dp fixed) for `In play` and `Net P/L`. Claim headline already uses `fmtClaimHeadline` (up to 4dp). If a user has 0.0075 USDT in play it shows as `0.01` or `0.00` depending on rounding, which is the same class of confusion we just fixed for “To claim”.

**Ask.** Apply the same `fmtClaimHeadline`-style 2–4dp progressive formatting to `inBets` and `totalProfit`. Name the helper `formatTokenHeadline(n)` and use everywhere.

**Acceptance.** `0.0075 USDT` displays as `0.0075` or `0.01`, not silently `0.00`.

**Files.** `src/components/BetsSummaryStrip.tsx`.

---

## 30. Global error uses `unstable_retry` and only `console.error`

**Context.** `src/app/global-error.tsx` imports `unstable_retry` (Next 15 experimental). This may move; also, logging to `console.error` alone means Vercel Logs is the only sink. No Sentry / LogRocket / analytics hook.

**Ask.**

1. Wrap the `unstable_retry` call in a `try / catch` that falls back to `window.location.reload()`. Dependency on unstable API should degrade gracefully.
2. Consider plumbing errors to Vercel Analytics (`sendServerAction`) or a lightweight telemetry endpoint so we can correlate production errors across wallets.

**Acceptance.** If the unstable import is renamed by Next, the retry button still works.

**Files.** `src/app/global-error.tsx`.

---

## 31. CSP + inline `<style>` from Next.js font-loader

**Context.** `Geist` / `Geist_Mono` from `next/font/google` inject inline `<style>` tags. Our CSP sets `style-src 'self' 'unsafe-inline'`, which covers this. If in the future we try to tighten to `style-src 'self' 'nonce-…'` (we already emit a `nonce` for scripts but don’t apply it to styles), these fonts break silently.

**Ask.** Either:

- Leave as-is, add a comment in `middleware.ts` saying “`'unsafe-inline'` required for `next/font` injected `<style>` tags”.
- Or use `<Geist preload …>` with a `next/font` config that lets us thread the nonce; current Next API does not cleanly support it.

**Acceptance.** Intent documented; no surprise regressions when someone “hardens” the CSP.

**Files.** `src/middleware.ts`.

---

## 32. Accessibility drift — non-text buttons lack labels, combobox aria spec

**Context.** Inspecting components found a few spots:

- `SearchBar.tsx` uses `role="combobox"` on the input without `aria-expanded` being tied to the panel state when loading-only. The panel opens and closes via `showPanel`; `aria-expanded={showPanel}` matches, but `role="combobox"` in WAI-ARIA 1.2 also expects `aria-controls` to point at the active listbox regardless of panel state. Today it does only when shown.
- Mobile search toggle button has `aria-label` + `aria-expanded`, good.
- `CashoutButton` dialog: overlay is a `role="presentation"` that closes on click. Touch users with VoiceOver can inadvertently dismiss.
- `Header` chain pill: `aria-haspopup={isConnected ? "menu" : undefined}` disappears when disconnected → screen reader announces it as a plain button. Fine, but add a tooltip via `aria-describedby` explaining “connect a wallet to switch network”.

**Ask.** Small batch PR:

1. Always include `aria-controls` on `SearchBar` combobox input.
2. Dialogs with backdrop dismissal: also wire `onKeyDown={e => e.key==='Escape' && ...}` and explicit “Cancel” is primary escape.
3. Ensure every icon-only button has an `aria-label` (audit pass).
4. Replace `title=` tooltips that carry critical info (e.g. Claim all button) with visible help text on ≥md screens (§11).

**Acceptance.** axe-core run on `/`, `/live`, `/bets`, `/games/[id]` shows zero serious issues.

**Files.** `src/components/SearchBar.tsx`, `src/components/CashoutButton.tsx`, `src/components/Header.tsx`, etc.

---

## 33. `useSwitchChain` / wagmi chain switching — no optimistic UI after confirmation

**Context.** `Header.tsx` chain switcher: `await switchChainAsync({ chainId: id })`. On success the wallet changes; `SportsChainSync` picks it up and `router.refresh()`. But between click and refresh (up to ~1 s), the pill still reads the old chain and the “Unsupported” banner may flicker. Not broken, but feels sluggish.

**Ask.**

1. After `switchChainAsync` resolves, eagerly call `setAppChainId(id)` in Header (or emit a client event `SportsChainSync` can listen to) to update UI immediately.
2. Add a spinner next to the pill during `switchPending`.

**Acceptance.** Pill label + banner update within one render tick of wallet confirmation.

**Files.** `src/components/Header.tsx`, `src/components/SportsChainSync.tsx`.

---

## Updated suggested order

After the current 11 items in §1–§11, the highest-leverage next items from this pass are:

1. **§12 Drift rounding** — silences most remaining yellow-banner complaints.
2. **§18 single settled-history provider** — removes a real hotspot and simplifies §3.
3. **§13 error helper split** + **§22 server leak** — stabilises error UX in one pass.
4. **§17 pending bets polling cursor** — quiet win on RPC usage.
5. **§19/§20/§21/§28 casino hooks refactor** — biggest code-health win, can be scoped into its own PR.
6. Everything else.
