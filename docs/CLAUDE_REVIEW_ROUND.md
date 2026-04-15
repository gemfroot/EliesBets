# Claude Code — code review conversation (context from Cursor agent)

You are reviewing **EliesBets** after a **sports-first launch** pass. The product vision: **ship sports betting (Azuro) as the main experience**; **casino is deferred** until we explicitly enable it.

## What we changed (summary for you)

1. **`src/lib/chains.ts`** — Header network switcher is **Polygon + Gnosis only** (Azuro sports chains). Removed Base/Avalanche from that dropdown so users aren’t steered to casino-only chains for sports.

2. **`src/app/casino/CasinoGate.tsx` + `layout.tsx`** — All `/casino/*` routes are wrapped: unless **`NEXT_PUBLIC_CASINO_ENABLED=true`**, users see a **“Casino — coming soon”** overlay and cannot interact with casino UI (children rendered inert underneath).

3. **`src/components/Sidebar.tsx`**, **`MobileLayoutChrome.tsx`** — Casino nav is **not a link**; shows **“Soon”** / disabled styling.

4. **`src/app/terms/page.tsx`**, **`src/app/privacy/page.tsx`** — Placeholder legal pages; **`Footer.tsx`** links to them; **`sitemap.ts`** includes `/terms` and `/privacy`.

5. **`.env.example`** — Documents `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_CASINO_ENABLED`, optional casino overrides.

6. **`tsconfig.json`** — **`target`: `ES2020`** so BigInt literals typecheck in `next build`.

7. **`eslint.config.mjs`** — Ignores **`contracts/**`** (Node deploy scripts).

8. **`src/components/LiveGamesList.tsx`** — **`effectiveSport`** derived state instead of `setState` inside `useEffect` (lint / React rules).

9. **`src/lib/casino/hooks.ts`** — Coin toss **`wager`** first arg is **`!betHeads`** to match BetSwirl semantics (`true` = tails on-chain).

10. **`docs/SPORTS_LAUNCH_TRACKER.md`**, **`docs/SPORTS_SMOKE_TESTS.md`**, **`docs/MIDDLEWARE_NEXT16.md`**, **`vercel.json`**.

## What we want from you

**Part A — Review**  
Given the vision above, critique the implementation: consistency, edge cases (e.g. user bookmarks `/casino/dice`), security headers unchanged, anything confusing for users switching networks for **sports**.

**Part B — Suggestions**  
List **up to 5 concrete** follow-ups (file-level if possible), prioritized **P0 / P1 / P2**. Say **“no change needed”** if something is already adequate.

**Part C — Optional improvements**  
If you would make **exactly 2 small code changes** yourself (each &lt; ~40 lines), what would they be and why?

Reply in **markdown** with clear sections A / B / C.
