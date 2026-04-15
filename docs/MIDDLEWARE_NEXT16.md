# Middleware and Next.js 16

Next.js 16 may log that `middleware` is deprecated in favor of a `proxy` file. Our app uses `src/middleware.ts` for:

- Per-IP rate limiting on `/api/search`
- Content-Security-Policy and other security headers on HTML routes

**Current decision:** keep `middleware.ts` until the Next.js migration path for CSP + rate limiting in `proxy` is documented and stable for our stack. Re-test builds and headers after each Next.js minor upgrade.

When migrating, preserve:

1. CSP nonce behavior for scripts
2. Rate limit semantics (or move limits to an edge KV / external API)
