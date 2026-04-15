# Implementation plan — sports tech (no legal/KYC)

Derived from [SPORTS_TECH_HANDOFF.md](./SPORTS_TECH_HANDOFF.md). Execute in order; test after each major step.

## 1. Single source of chain for Azuro + SSR

- Add `getSportsChainId()` reading Azuro SDK cookie `appChainId` (`cookieKeys` from `@azuro-org/sdk`), validating against `HEADER_SWITCHER_CHAIN_IDS`.
- Pass `initialAzuroChainId` from root layout into `AzuroSDKProvider` so hydration matches SSR.

## 2. Client alignment

- **Header:** after successful `switchChainAsync`, call `setAppChainId(id)` and `router.refresh()`.
- **SportsChainSync:** when wallet is connected on Polygon/Gnosis and `chainId !== appChain.id`, call `setAppChainId(chainId)` and `router.refresh()` (covers MetaMask network changes).

## 3. Thread `chainId` on the server

- Replace static `CHAIN_ID` in toolkit calls with `await getSportsChainId()` in: home sections, live, game detail (+ metadata), sports tree pages, `sportGames` helpers, `fetchTopOddsByGameId`.
- **`/api/search`:** use `getSportsChainId()` so search matches listings.

## 4. Sitemap

- Use `DEFAULT_SPORTS_CHAIN_ID` only (crawlers have no cookie); document why.

## 5. Middleware

- Drop `setInterval`; prune expired rate-limit keys when handling `/api/search`.

## 6. Misc

- Explorer fallbacks in `betShare` for Polygon + Gnosis (+ Amoy if needed).

## 7. Verify

- `npm run build`, `npm run lint` on a healthy CI/host.
- Manual smoke: switch Polygon ↔ Gnosis; confirm listings, game page, search, and betslip all refer to the same chain.
