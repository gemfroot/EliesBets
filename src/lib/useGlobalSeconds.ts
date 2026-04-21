"use client";

import { useSyncExternalStore } from "react";

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

function getServerSnapshot() {
  return Date.now();
}

/**
 * One shared clock tick per tab (replaces per-card `setInterval` for countdowns / live badges).
 */
export function useGlobalSeconds(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
