# Vercel security bulletin (April 2026) — EliesBets checklist

Official bulletin: [Vercel April 2026 security incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident).

Vercel reported unauthorized access to **some internal systems**; a **limited subset** of customers may be contacted directly. Services stayed up. **All customers** were asked to follow secret-handling best practices.

## Do this in the Vercel dashboard (not automatable from git)

1. **Review environment variables**  
   Project → Settings → Environment Variables → use the **single-page** view Vercel recommends in the bulletin.

2. **Mark sensitive values as Sensitive**  
   So they are not echoed in build logs where the platform supports it. Prefer **server-only** names (no `NEXT_PUBLIC_`) for anything that must stay secret.

3. **Rotate secrets if there is any doubt**  
   Especially anything that could have been exposed via Vercel internals (third-party API keys, deploy hooks, non-public tokens).  
   - [WalletConnect Cloud](https://cloud.walletconnect.com) — rotate `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` if you treat it as sensitive (note: `NEXT_PUBLIC_*` is still exposed to the browser at runtime).  
   - Any **server** env used in API routes or Edge — rotate if applicable.

4. **Access control**  
   Confirm Vercel / GitHub org members and **deploy hooks** are minimal. Remove stale integrations.

5. **Support**  
   [vercel.com/help](https://vercel.com/help) for rotation help, per the bulletin.

## What this repo already does

- **`.gitignore`** ignores `.env*` (only `.env.example` is tracked).  
- **`scripts/check-static-sources.mjs`** (npm `check:static`) scans `src/` for obvious secret-like strings and PEM private-key headers. Run in CI before merge.

## This app’s env surface

- **`NEXT_PUBLIC_*`** — baked into the client bundle; **not** confidential. Still worth rotating if a bulletin or leak suggests platform-side exposure of *values you also store elsewhere*.  
- **No server-only wallet keys** in the Next app source; deploy keys live only in local/CI `contracts/` scripts and must stay out of git.

Re-run `npm run check:static` after substantive edits to `src/`.
