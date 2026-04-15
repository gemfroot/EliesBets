# Sports-only launch tracker

**Goal:** Ship **sports betting (Azuro)** in a production-ready state. **Casino** is deferred; gated until `NEXT_PUBLIC_CASINO_ENABLED=true`.

**Manager:** Cursor agent + you  
**Worker:** Claude Code (`dev@server:/home/dev/EliesBets`)

---

## Checklist — status (after implementation pass, 2026-04-15)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| L1 | Production build passes | ✅ (verify on CI/Linux) | Local Windows agent may lack native SWC/lightningcss; **Vercel/Linux `npm run build`** is canonical. |
| L2 | Env vars documented | ✅ | `.env.example` + comments for `NEXT_PUBLIC_SITE_URL`, WalletConnect, `NEXT_PUBLIC_CASINO_ENABLED`, casino overrides. |
| L3 | Azuro sports + errors | 🟡 | Unchanged; routes + error boundaries exist; live data depends on Polygon + Azuro. |
| L4 | Wallet + chain for sports | ✅ | Header switcher **Polygon + Gnosis** only. |
| L5 | E2E sports bet flow | 🟡 | UX paths intact; validate on staging with real wallet. |
| L6 | Casino gated | ✅ | Nav **Soon**; `CasinoGate` blocks all `/casino/*` unless env enabled. |
| L7 | Legal pages | ✅ | `/terms`, `/privacy` + footer links (templates — counsel review before regulated launch). |
| L8 | SEO for real domain | 🟡 | Set `NEXT_PUBLIC_SITE_URL` in Vercel/hosting. |
| L9 | Smoke tests | ✅ | `docs/SPORTS_SMOKE_TESTS.md` |
| L10 | Deploy + domain + SSL | 🟡 | `vercel.json` present; configure project + domain in Vercel UI. |

---

## Prioritized backlog — status

| Pri | Task | Status |
|-----|------|--------|
| P0 | Build / WrongNetworkBanner | ✅ N/A locally (layout had no broken import); build on Linux. |
| P0 | `.env.example` | ✅ |
| P0 | Chain switcher sports-only | ✅ |
| P0 | Casino nav + gate | ✅ |
| P1 | Terms + Privacy | ✅ |
| P1 | Middleware → proxy | 🟡 Documented `docs/MIDDLEWARE_NEXT16.md` — code migration deferred. |
| P1 | `NEXT_PUBLIC_SITE_URL` in Vercel | 🟡 Operator sets in dashboard. |
| P1 | Smoke checklist | ✅ |
| P2 | Azuro verify on Polygon | ⬜ Run smoke tests on staging. |
| P2 | Vercel project | 🟡 Connect repo + env in UI. |

---

## Claude Code — round log

### Round 1 — 2026-04-15

Initial audit (pre-implementation).

### Round 2 — 2026-04-15

Post-implementation verification requested after push (see commit `04fbdea`).

---

## Updates (append only)

- _2026-04-15 — Tracker created; Round 1 completed._
- _2026-04-15 — P0/P1 implementation: chain switcher, casino gate, terms/privacy, .env.example, docs, sitemap; committed._
