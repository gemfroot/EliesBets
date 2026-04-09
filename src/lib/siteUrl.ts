/** Canonical site origin for metadata, sitemap, and robots (see root `layout.tsx`). */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function getSiteOrigin(): string {
  return getSiteUrl().replace(/\/$/, "");
}
