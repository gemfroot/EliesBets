# Pre-launch test checklist

Run before calling a release “live.” Check **pass / fail** and note the date.

**Production URL (example):** `https://eliesbets.vercel.app` (or your custom domain — use that everywhere below).

See also: [`SPORTS_SMOKE_TESTS.md`](./SPORTS_SMOKE_TESTS.md) (sports-focused smoke, still valid).

---

## You test (human / wallet / device)

These need a browser, wallet, or real UX judgment.

### Environment & accounts

- [ ] **`NEXT_PUBLIC_SITE_URL`** in Vercel matches the **exact** public origin you’ll ship (no trailing slash mismatch in metadata/sitemap).
- [ ] **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** set if you rely on WalletConnect QR (unset = WC hidden in `wagmi.ts`).
- [ ] **Casino policy:** confirm `NEXT_PUBLIC_CASINO_ENABLED` is what you want (`false` = gated “soon” only).

### Wallet & chains (sports)

- [ ] Connect with your primary wallet (e.g. MetaMask); **disconnect and reconnect** once.
- [ ] If you use **WalletConnect / mobile wallet**, connect and complete one navigation flow.
- [ ] **Polygon ↔ Gnosis ↔ Base** via header switcher: network label updates, no stuck “wrong network” for sports after sync.
- [ ] **Unsupported chain** (e.g. Avalanche): header shows **Unsupported**; switch to Polygon, Gnosis, or Base succeeds.
- [ ] Optional: switch chain **only in the wallet** (not header) — listings should follow after **SportsChainSync** + refresh (may take a moment).

### Core sports flows

- [ ] **Home** (`/`): loads; live hero + sports nav + lists or clear empty states.
- [ ] **Live** (`/live`): loads; error state is the app error UI, not a blank page.
- [ ] **Drill-down:** sport → country → league → **game** (`/games/[id]`): markets load; add/remove selections.
- [ ] **Betslip:** stake input, approve if needed, **place a small bet** on **Polygon**; tx confirms or reverts with a **clear** message.
- [ ] Repeat a **small bet on Gnosis** and/or **Base** if you market those chains (same checks).
- [ ] **My bets** (`/bets`): list loads; tabs/filters if you use them.
- [ ] **Search** (header): 3+ chars, results or empty; no endless spinners.
- [ ] **Odds format** (header): decimal / fractional / american toggles and display updates.

### Errors & edge cases

- [ ] **Reject signature** or **insufficient balance**: UI shows a sensible message (no raw stack trace).
- [ ] **Casino:** sidebar/mobile **Soon**; `/casino` shows coming-soon / gate unless casino explicitly enabled.
- [ ] **Legal:** `/terms`, `/privacy` render; footer links work.

### Mobile & polish

- [ ] **Mobile** (iOS Safari + Android Chrome if possible): bottom nav, betslip drawer, no broken horizontal scroll, tap targets usable.
- [ ] **Console:** open `/` and `/live` — no red errors on first paint (warnings may exist).

### Post-win / settlement (if you can wait)

- [ ] **Settled bet:** redeem / cashout paths if shown; **My bets** updates after settlement (or refresh).

---

## Agent / automation / scripts

These can be done by a **Cursor agent**, **CI**, or **shell** (no wallet).

### Build & repo

- [ ] **`npm run build`** passes (Linux or Vercel — source of truth for native/tooling issues).
- [ ] **`./scripts/verify-linux.sh`** (or `SKIP_CI=1` when `node_modules` exists) on a Linux clone. After lint + static checks it runs **`npm run check:static`**. Optional: **`SMOKE_PROD=1 ./scripts/verify-linux.sh`** to also hit production HTTP smoke (needs outbound network).
- [ ] **`npm run lint`** — know current status (`contracts/` may fail unless ignored; align `eslint` with policy).
- [ ] **`npm run check:static`** — scans `src/` for stray localhost (allowlisted in `lib/siteUrl.ts`) and obvious secret-like strings.

### HTTP / production smoke (curl or browserless)

- [ ] **`npm run smoke:prod`** (or `SMOKE_BASE_URL=https://your.domain node scripts/smoke-production.mjs`) — `GET` `/`, `/live`, `/bets`, `/terms`, `/privacy`, `/casino`, `/robots.txt`, `/sitemap.xml` (HTTPS locs), `/api/search?q=test`, and one **`/games/<id>`** from the sitemap. Expect `200` and JSON from search.
- [ ] **`curl -sI https://eliesbets.vercel.app/`** — `200`, reasonable `cache-control`, security headers (CSP, etc.) from middleware (optional if you ran `smoke:prod`).
- [ ] **`curl -sI`** on `/live`, `/bets`, one `/games/<id>` — not `5xx` (optional if you ran `smoke:prod`).
- [ ] **`/robots.txt`** — `200`, expected rules.
- [ ] **`/sitemap.xml`** — `200`, URLs use **HTTPS** production host.
- [ ] **`/api/search?q=test`** — `200` JSON (empty `games` ok); intentional `429` only under abuse (rate limit).

### Static / safety checks (grep, review)

- [ ] Grep `src/` for **`localhost`**, **`127.0.0.1`**, stray **`console.log`** in hot paths (optional cleanup — **`npm run check:static`** covers localhost/secret patterns in `src/`).
- [ ] No **private keys** or **API secrets** committed; `NEXT_PUBLIC_*` only for client-safe values.
- [ ] **Client/server split:** server-only modules (e.g. `next/headers`) not imported from client-only entrypoints (Vercel build catches many cases).

### Vercel / deploy

- [ ] Latest **production deployment** is **READY** and aliased to your public domain.
- [ ] **Analytics** (e.g. Vercel Analytics) loads if you use it — spot-check one session in the dashboard.

### Optional / heavier

- [ ] **Lighthouse** (manual or CI): performance / SEO / a11y on `/` and one game page.
- [ ] **Sentry** (if configured): trigger a test error and confirm it appears (optional).

---

## Sign-off

| Role        | Name | Date | Notes |
|------------|------|------|--------|
| Human QA   |      |      |        |
| Automation |      |      |        |

---

*Claude Code contributed categories for human vs automated coverage; merged with `SPORTS_SMOKE_TESTS.md` and production learnings.*
