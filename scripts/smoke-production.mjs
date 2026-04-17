#!/usr/bin/env node
/**
 * HTTP smoke tests against a deployed origin (no wallet).
 * Usage: node scripts/smoke-production.mjs
 *        SMOKE_BASE_URL=https://your-domain.com node scripts/smoke-production.mjs
 */
const BASE = (process.env.SMOKE_BASE_URL ?? "https://eliesbets.vercel.app").replace(
  /\/$/,
  "",
);

let failed = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`OK:   ${msg}`);
}

async function checkGet(path, { acceptStatuses = [200], label = path } = {}) {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let res;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "*/*", "User-Agent": "EliesBets-smoke/1.0" },
    });
  } catch (e) {
    fail(`${label} — ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  if (!acceptStatuses.includes(res.status)) {
    fail(`${label} — ${res.status} (expected ${acceptStatuses.join("|")})`);
    return null;
  }
  ok(`${label} — ${res.status}`);
  return res;
}

async function main() {
  console.log(`Smoke base: ${BASE}\n`);

  await checkGet("/", { label: "GET /" });
  await checkGet("/live", { label: "GET /live" });
  await checkGet("/bets", { label: "GET /bets" });
  await checkGet("/terms", { label: "GET /terms" });
  await checkGet("/privacy", { label: "GET /privacy" });
  await checkGet("/casino", { label: "GET /casino" });
  await checkGet("/robots.txt", { label: "GET /robots.txt" });

  const sitemapRes = await checkGet("/sitemap.xml", { label: "GET /sitemap.xml" });
  if (sitemapRes) {
    const xml = await sitemapRes.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
    if (locs.length === 0) {
      fail("sitemap.xml — no <loc> entries");
    } else {
      const bad = locs.filter((u) => !u.startsWith("https://"));
      if (bad.length) {
        fail(`sitemap.xml — non-HTTPS loc: ${bad.slice(0, 3).join(", ")}`);
      } else {
        ok(`sitemap.xml — ${locs.length} loc(s), all https://`);
      }
      const gameUrl = locs.find((u) => /\/games\/[^/]+$/i.test(u));
      if (gameUrl) {
        const gamePath = new URL(gameUrl).pathname;
        await checkGet(gamePath, { label: `GET sample game ${gamePath}` });
      } else {
        ok("sitemap — no /games/ URL to sample (skipped game page check)");
      }
    }
  }

  const searchRes = await checkGet("/api/search?q=test", { label: "GET /api/search?q=test" });
  if (searchRes) {
    const ct = searchRes.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      fail(`/api/search — expected JSON content-type, got ${ct || "(empty)"}`);
    } else {
      try {
        const body = await searchRes.clone().json();
        if (typeof body !== "object" || body === null) {
          fail("/api/search — JSON is not an object");
        } else {
          ok("/api/search — valid JSON object");
        }
      } catch (e) {
        fail(`/api/search — invalid JSON: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(`Done: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("Done: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
