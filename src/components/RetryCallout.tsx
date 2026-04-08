"use client";

import { useRouter } from "next/navigation";

type RetryCalloutProps = {
  title: string;
  description?: string;
  /** When omitted, uses `router.refresh()` (full segment re-fetch). */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function RetryCallout({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: RetryCalloutProps) {
  const router = useRouter();

  function handleRetry() {
    if (onRetry) {
      onRetry();
    } else {
      router.refresh();
    }
  }

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-900/40 bg-red-950/25 p-4 ${className}`.trim()}
    >
      <p className="text-sm font-medium text-red-200">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-red-200/80">{description}</p>
      ) : null}
      <button
        type="button"
        onClick={handleRetry}
        className="mt-3 rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-1.5 text-sm font-medium text-red-100 transition hover:bg-red-950/70"
      >
        {retryLabel}
      </button>
    </div>
  );
}
