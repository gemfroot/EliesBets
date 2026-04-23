"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Auto-tick `router.refresh()` while the tab is visible. This lifts the new
 * ISR snapshot the server already has cached (each list page's
 * `export const revalidate = N`) into the client without the thundering-herd
 * pattern of per-card refetches that previously cascaded into an Azuro +
 * wagmi render loop. One request every `intervalMs`, consistent snapshot.
 */
function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

/**
 * "↻ Refresh" button — on-demand version of the same `router.refresh()`.
 * Disables briefly so repeat mashing doesn't queue up requests.
 */
function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        window.setTimeout(() => setBusy(false), 600);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-wait disabled:opacity-60"
      aria-label="Refresh odds"
      title="Pulls the latest cached odds from the server"
    >
      <span aria-hidden className={busy ? "inline-block animate-spin" : "inline-block"}>↻</span>
      <span>{busy ? "Refreshing…" : "Refresh odds"}</span>
    </button>
  );
}

/**
 * Drop this at the top of a list page (home, sport, country, league) to get
 * both a background auto-refresh tick and a user-triggered refresh button.
 * Default cadence matches the server ISR revalidate of most list pages (45s)
 * so we rarely hit the upstream subgraph more than once per window.
 */
export function OddsRefreshControls({
  intervalMs = 20_000,
  className,
}: {
  intervalMs?: number;
  className?: string;
}) {
  return (
    <div className={className ?? "mb-3 flex justify-end"}>
      <AutoRefresh intervalMs={intervalMs} />
      <RefreshButton />
    </div>
  );
}
