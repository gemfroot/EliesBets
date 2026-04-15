import { NextResponse, type NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const casinoEnabled = process.env.NEXT_PUBLIC_CASINO_ENABLED === "true";
  if (!casinoEnabled && pathname.startsWith("/casino")) {
    return NextResponse.redirect(new URL("/", request.url));
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

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "on");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|og-image\\.png).*)",
  ],
};
