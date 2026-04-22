"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

let nowMs = Date.now();
const listeners = new Set<() => void>();
/** Browser timer handle (`window.setInterval`); avoid `NodeJS.Timeout` from Node typings. */
let intervalId: number | null = null;

function ensureInterval() {
  if (intervalId != null || typeof window === "undefined") {
    return;
  }
  intervalId = window.setInterval(() => {
    nowMs = Date.now();
    for (const l of listeners) {
      l();
    }
  }, 1000);
}

function subscribe(onStoreChange: () => void) {
  ensureInterval();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return nowMs;
}

/** `0` sentinel — callers skip time-dependent rendering until the post-mount `useEffect` swaps in the live clock. */
function getServerSnapshot() {
  return 0;
}

/**
 * One shared clock tick per tab (replaces per-card `setInterval` for countdowns / live badges).
 *
 * Returns `0` during SSR and the first client render, then the live epoch-ms
 * after mount. Rendering against `Date.now()` at hydration time caused React
 * error #418 (text mismatch: server's T0 ≠ client's T0+Δ). Callers must
 * tolerate `0` — typically by falling back to a static placeholder so the
 * SSR output and first client paint are byte-identical.
 */
export function useGlobalSeconds(): number {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const live = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mounted ? live : 0;
}
