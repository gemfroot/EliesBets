"use client";

import { useEffect } from "react";
import { RetryCallout } from "@/components/RetryCallout";

export default function RouteSegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const detail = error?.message
    ? `${error.message}${error.digest ? ` [digest: ${error.digest}]` : ""}`
    : "This page could not be displayed. You can try again, or go back and return later.";

  return (
    <div className="page-shell">
      <RetryCallout
        title="Something went wrong"
        description={detail}
        onRetry={unstable_retry}
      />
    </div>
  );
}
