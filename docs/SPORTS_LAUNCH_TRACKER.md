# Sports-only launch tracker

**Goal:** Ship **sports betting (Azuro)** in a production-ready state. **Casino** is deferred; entry points may be hidden or “Coming soon.”

**Manager:** Cursor agent + you  
**Worker:** Claude Code (`dev@server:/home/dev/EliesBets`)

---

## Phase — objectives

1. **Build & deploy:** `next build` green; prod env vars; hosting configured.  
2. **Azuro / data:** Sports/fixtures/odds reliable; error/empty states.  
3. **Wallet & chain:** Correct networks for **sports** (Polygon + Gnosis for Azuro — verify in code).  
4. **Core sports UX:** Browse → game → betslip → submit → My bets.  
5. **Casino:** Hide or “Coming soon” — no promise of working games.  
6. **Legal:** Terms + Privacy (or explicit gaps).  
7. **SEO:** Real `metadataBase` / sitemap / robots for production URL.  
8. **Security / API:** Headers, rate limits — sanity check.  
9. **Observability:** Analytics + error boundaries.  
10. **QA:** Documented smoke tests.

---

## Checklist — status (updated after Claude Round 1)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| L1 | Production build passes | 🟡 / Missing | Server audit: import `WrongNetworkBanner` missing + stray nested dir — **verify local `layout.tsx` vs server** (local copy may differ). |
| L2 | Env vars documented | Missing | Need `.env.example`; at least `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`; document casino `NEXT_PUBLIC_*` overrides if any. |
| L3 | Azuro sports + errors | Partial | Routes + error/loading exist; `CHAIN_ID` hardcoded — verify live data on Polygon. |
| L4 | Wallet + chain for sports | Partial | Switcher mixes casino chains; Gnosis may be missing for sports; needs sports-only or context-aware UX. |
| L5 | E2E sports bet flow | Partial | Routing + betslip present; verify on running build. |
| L6 | Casino gated | Missing | Sidebar + mobile still link to full casino; no “Coming soon” gate. |
| L7 | Legal pages | Partial | Footer has RG links; **no /terms or /privacy**. |
| L8 | SEO for real domain | Partial | `metadataBase` uses `getSiteUrl()` — **must set `NEXT_PUBLIC_SITE_URL` in prod**. |
| L9 | Smoke tests | Missing | No automated tests; no written checklist yet. |
| L10 | Deploy + domain + SSL | Unknown | Analytics suggests Vercel; no `vercel.json` / domain config in repo. |

Legend: ⬜ not started · 🟡 in progress / partial · ✅ done · ⏸️ blocked

---

## Prioritized backlog (from Claude Code Round 1)

| Pri | Task |
|-----|------|
| **P0** | Fix production build (resolve `WrongNetworkBanner` or remove import; fix nested duplicate `EliesBets/` if present on server). |
| **P0** | Add `.env.example` + document required prod vars. |
| **P0** | Align chain switcher with **sports** (Polygon + Gnosis); don’t steer users to casino-only chains for sports. |
| **P0** | Gate casino in **Sidebar** + **MobileLayoutChrome** (“Coming soon” or remove links). |
| **P1** | Add `/terms` and `/privacy` (placeholder OK); link from Footer. |
| **P1** | Plan **middleware → proxy** migration (Next 16 deprecation warning). |
| **P1** | Set `NEXT_PUBLIC_SITE_URL` in Vercel/hosting env. |
| **P1** | Write **manual smoke test checklist** (sports paths). |
| **P2** | Verify Azuro data on Polygon mainnet in a running deploy. |
| **P2** | Vercel project: env, domain, SSL, CI build. |

---

## Launch risks (summary)

- **Build broken** on server if `WrongNetworkBanner` imported without file — blocks deploy.  
- **Wrong SITE_URL** → SEO/sitemap point at localhost.  
- **Wrong chain** → users on Base/AVAX try sports and fail.  
- **No Terms/Privacy** — compliance gap.  
- **Casino routes live** — unfinished games reachable.

---

## Claude Code — round log

### Round 1 — 2026-04-15 ✅

**Input:** `docs/SPORTS_LAUNCH_TRACKER.md` (initial) + full `src/` scan.

**Delivered:** L1–L10 validation table, top 10 tasks, casino minimal-change table, risk table. (Full narrative preserved in git history / this section.)

**Server fix applied:** `dev` user can SSH with same key as `root` (authorized_keys mirrored) so `claude -p` runs **without** root (Claude Code refuses root headless).

**Sync note:** `/home/dev/EliesBets` may differ from `c:\Users\Administrator\.openclaw-dev\EliesBets` — **git pull/push** before each round so Claude and Cursor edit the same commit.

---

### Round 2 (next)

- [ ] Align local + server repos.  
- [ ] Execute P0 items (build, `.env.example`, chain UX, casino nav).  
- [ ] Re-run `claude -p` with: “Verify fixes for P0; update L1–L10 table; any new gaps?”

---

## Updates (append only)

- _2026-04-15 — Tracker created; dev SSH enabled; Round 1 completed; backlog + risks merged._
