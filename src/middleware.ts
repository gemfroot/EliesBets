import { NextResponse, type NextRequest } from "next/server";
import {
  CHAIN_SLUGS,
  DEFAULT_CHAIN_SLUG,
  isChainSlug,
  isValidSportsChainId,
  type ChainSlug,
} from "@/lib/sportsChainConstants";
import { CHAIN_SLUG_BY_ID } from "@/lib/sportsChainConstants";

const APP_CHAIN_ID_COOKIE = "appChainId";
/** Cookie storing the URL slug; kept in lockstep with appChainId for wallet/SDK. */
const CHAIN_SLUG_COOKIE = "chainSlug";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

/**
 * Routes that used to be cookie-scoped (`/sports/…`, `/live`, `/`) now live
 * under a chain-prefixed path (e.g. `/polygon/sports/baseball`). Middleware
 * preserves the old URLs by redirecting into the right chain. Chain comes
 * from the existing cookie if set; otherwise the default (Polygon).
 */
const LEGACY_CHAIN_PREFIXED_PATHS: readonly string[] = [
  "/sports",
  "/live",
];

function chainSlugFromCookie(request: NextRequest): ChainSlug {
  const slugCookie = request.cookies.get(CHAIN_SLUG_COOKIE)?.value;
  if (slugCookie && isChainSlug(slugCookie)) {
    return slugCookie;
  }
  const idCookie = request.cookies.get(APP_CHAIN_ID_COOKIE)?.value;
  if (idCookie) {
    const id = Number.parseInt(idCookie, 10);
    if (Number.isFinite(id) && isValidSportsChainId(id)) {
      return CHAIN_SLUG_BY_ID[id];
    }
  }
  return DEFAULT_CHAIN_SLUG;
}

/**
 * Best-effort rate limit only: each Edge instance keeps its own map, so the effective
 * ceiling is roughly per-instance (not global). Stronger protection needs Redis/KV.
 */
const hitsByIp = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredRateLimitEntries() {
  const now = Date.now();
  for (const [ip, entry] of hitsByIp) {
    if (now >= entry.resetAt) hitsByIp.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  pruneExpiredRateLimitEntries();
  const now = Date.now();
  const entry = hitsByIp.get(ip);
  if (!entry || now >= entry.resetAt) {
    hitsByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function buildStandardResponse(): NextResponse {
  // Per-request nonces require dynamic rendering; we stream statically-shelled
  // pages, so rely on 'self' + 'unsafe-inline' and strict connect/frame/object
  // rules instead.
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https: wss:`,
    `frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-DNS-Prefetch-Control", "on");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const casinoDisabled = process.env.NEXT_PUBLIC_CASINO_ENABLED === "false";
  if (casinoDisabled && pathname.startsWith("/casino")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Legacy URL migration: `/` → `/<chain>`, `/sports/…` → `/<chain>/sports/…`,
  // `/live` → `/<chain>/live`. Pick chain from cookie or the default.
  if (pathname === "/") {
    const chain = chainSlugFromCookie(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${chain}`;
    return NextResponse.redirect(url);
  }
  for (const prefix of LEGACY_CHAIN_PREFIXED_PATHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const chain = chainSlugFromCookie(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${chain}${pathname}`;
      return NextResponse.redirect(url);
    }
  }
  // Chain-prefixed path: keep the cookie in sync so wallet/SDK + legacy
  // `getSportsChainId()` paths (bets, api/search) see the same chain.
  const firstSegment = pathname.split("/", 2)[1];
  if (firstSegment && (CHAIN_SLUGS as readonly string[]).includes(firstSegment)) {
    const urlSlug = firstSegment as ChainSlug;
    const cookieSlug = request.cookies.get(CHAIN_SLUG_COOKIE)?.value;
    if (cookieSlug !== urlSlug) {
      const response = buildStandardResponse();
      // Let client-side set httpOnly=false cookies that SDK/wagmi can read.
      response.cookies.set(CHAIN_SLUG_COOKIE, urlSlug, {
        path: "/",
        sameSite: "lax",
      });
      const chainId =
        (Object.entries(CHAIN_SLUG_BY_ID).find(([, s]) => s === urlSlug)?.[0] ??
          "") as string;
      if (chainId) {
        response.cookies.set(APP_CHAIN_ID_COOKIE, chainId, {
          path: "/",
          sameSite: "lax",
        });
      }
      return response;
    }
  }

  if (pathname.startsWith("/api/search")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  return buildStandardResponse();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|og-image\\.png).*)",
  ],
};
