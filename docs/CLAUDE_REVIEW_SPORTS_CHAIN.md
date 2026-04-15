# Claude Code review — sports chain alignment (synced repo)

**Repo:** `/home/dev/EliesBets` @ `1f4363a` (initial review), then follow-up commit for P1.

## Initial review (Claude Code via MCP, after `git pull`)

**Verdict:** Ship-ready with one P1 fix.

**Strengths:** `sportsChain.ts` validation, `initialAzuroChainId` hydration, sitemap default, threading `getSportsChainId()` across server routes, safe Header error path.

**Issues raised:**

| Pri | Issue |
|-----|--------|
| P1 | Double `router.refresh()` — Header + `SportsChainSync` could both fire after header-driven chain switch. |
| P2 | No debounce on chain-switch effects (rapid toggles). |
| P2 | Confirm `useConnection` API for wagmi v3 (vs deprecated `useAccount` alias). |
| P3 | Cold-load refresh when wallet ≠ cookie — document as intentional. |

**Confidence:** 7/10 before P1 fix.

## Follow-up implemented (Cursor)

- **P1:** `Header` now only `await switchChainAsync({ chainId })`. **`SportsChainSync`** alone calls `setAppChainId` + debounced `router.refresh()` (120ms) so header and wallet switches share one code path.
- **P2 (partial):** Debounce on refresh in `SportsChainSync`.
- **wagmi:** `useConnection` is the canonical export in wagmi v3 (`useAccount` is deprecated alias) — no change.

---

_Re-run Claude Code after the follow-up commit for a fresh sign-off if needed._
