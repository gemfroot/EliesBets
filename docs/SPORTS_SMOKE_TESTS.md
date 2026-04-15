# Sports launch — manual smoke tests

Run before each production deploy. Check **pass / fail** and note the date.

## Environment

- [ ] `NEXT_PUBLIC_SITE_URL` is the production `https://…` origin (not localhost).
- [ ] Wallet: MetaMask (or primary wallet) on **Polygon** or **Gnosis** for sports.

## Core flows

1. [ ] **Home** (`/`) loads without error; featured sports / fixtures or empty state is acceptable.
2. [ ] **Live** (`/live`) loads; errors show the route error UI, not a white screen.
3. [ ] **Sports drill-down**: pick a sport → country → league → game detail (`/games/[id]`).
4. [ ] **Odds**: open a market, add selection to **betslip**; odds format toggle works (header).
5. [ ] **Place bet** (small amount / test wallet): transaction submits or reverts with a clear message.
6. [ ] **My bets** (`/bets`): list loads when connected; filters work if present.
7. [ ] **Search** (`/api/search` via UI): query returns or graceful empty; rapid requests do not 429 in normal use.
8. [ ] **Wrong network**: connect on an unsupported chain → header shows **Unsupported** (or switcher); switch to **Polygon** or **Gnosis** succeeds.
9. [ ] **Casino**: sidebar + mobile show **Soon**; `/casino` shows **coming soon** overlay (no playable casino) unless `NEXT_PUBLIC_CASINO_ENABLED=true`.
10. [ ] **Legal**: `/terms` and `/privacy` render; footer links work.

## Regression

- [ ] No console errors on first paint for `/` and `/live`.
- [ ] Mobile bottom nav: Home, Live, My Bets, Favorites behave as expected.
