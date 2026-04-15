# Sports tech debt — problem list & implementation plan

Legal / KYC / licensing are **out of scope** (leave on shelf).

## Problem collection

| ID | Area | Issue |
|----|------|--------|
| P0-A | Azuro app chain vs wallet | `AzuroSDKProvider` used fixed `initialChainId` (137). Header only called `switchChain` (wagmi). SDK keeps separate `appChainId` and exposes `setAppChainId` (via `useChain`). Gnosis in the switcher did not update Azuro state or SSR data. |
| P0-B | Server data vs chain | All toolkit calls used `CHAIN_ID` (137). Listings/search did not follow `appChainId` cookie the SDK sets when `setAppChainId` runs. |
| P1-A | Hydration | Client SDK must initialize with the same chain as the `appChainId` cookie from the server (`initialChainId` in layout). |
| P1-B | Wallet switches outside UI | If the user changes network in the wallet (Polygon ↔ Gnosis), Azuro should follow when that chain is a supported sports chain. |
| P2-A | Search API | `/api/search` was hard-coded to Polygon; should use the same cookie as the SDK. |
| P2-B | Sitemap | Crawlers often have no cookie; keep stable SEO using **default** sports chain (Polygon) only unless we add explicit multi-chain sitemap strategy later. |
| P2-C | Middleware rate limit | In-memory map + `setInterval` is weak on multi-instance Edge and `setInterval` is questionable in middleware. Prune expired entries per request instead of background timer. |
| P3 | Explorer fallbacks | `betShare.ts` hard-coded Polygonscan; add Gnosis for chain 100 when block explorer URL absent. |

## Plan (execution order)

1. Add `src/lib/sportsChain.ts`: `DEFAULT_SPORTS_CHAIN_ID`, `getSportsChainId()` via `cookies()` + Azuro `cookieKeys.appChainId`, validation against Polygon/Gnosis.
2. Pass `initialAzuroChainId` from root `layout.tsx` into `Providers` → `AzuroSDKProvider`.
3. Add `SportsChainSync` client component: when connected on Polygon/Gnosis, `setAppChainId` + `router.refresh()` if needed to align wallet with Azuro.
4. Update `Header.tsx`: `useChain`, `switchChainAsync` + `setAppChainId` + `router.refresh()` after successful switch.
5. Thread `chainId` from `getSportsChainId()` through server pages: `HomePageSections`, `live`, `games/[id]`, `sportGames` helpers, `oddsUtils.fetchTopOddsByGameId`, sports slug pages; `generateMetadata` where toolkit is used.
6. Update `/api/search` to resolve chain from `cookies()`.
7. Keep `sitemap.ts` on `DEFAULT_SPORTS_CHAIN_ID` only (document why).
8. Middleware: remove `setInterval`; prune expired rate-limit entries during handling.
9. Extend `betShare` explorer fallback for Gnosis.
10. Run `npm run build` and `npm run lint`.

## Verification

- `npm run build` / `npm run lint`
- Manual: set `appChainId` cookie to Gnosis (or switch in app), confirm home/live/game data reflects chain; search returns consistent results; switch back to Polygon.

---

## Execution log (2026-04-15)

Implemented in-repo (overseen in Cursor):

| Step | Status |
|------|--------|
| `src/lib/sportsChain.ts` + cookie-aligned SSR | Done |
| `Providers` / `layout` `initialAzuroChainId` | Done |
| `SportsChainSync` + Header `setAppChainId` + `router.refresh()` | Done |
| Server pages + `sportGames` + `oddsUtils` + `/api/search` | Done |
| Sitemap fixed to `DEFAULT_SPORTS_CHAIN_ID` | Done |
| Middleware rate-limit: removed `setInterval`, prune on each check | Done |
| `betShare` Gnosis explorer fallback | Done |

**Local Windows build** in this environment failed (native `lightningcss` / SWC / webpack tooling), not due to these edits. **On Linux** (e.g. Claude at `/home/dev/EliesBets`): run `chmod +x scripts/verify-linux.sh && ./scripts/verify-linux.sh`, or `npm run build` on **Vercel**, before release.

Formal step-by-step plan for Claude/other agents: [CLAUDE_IMPLEMENTATION_PLAN.md](./CLAUDE_IMPLEMENTATION_PLAN.md).
