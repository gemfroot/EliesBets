"use client";

import { useEffect, useState } from "react";

function parseStartMs(startsAt: string): number {
  const n = +startsAt;
  return n < 32_503_680_000 ? n * 1000 : n;
}

function formatElapsed(fromMs: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - fromMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LiveBadge({ startsAt }: { startsAt: string }) {
  const startMs = parseStartMs(startsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-red-400">
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
          aria-hidden
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span>
        LIVE · {formatElapsed(startMs, now)}
      </span>
    </span>
  );
}
