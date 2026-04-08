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

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <RetryCallout
        title="Something went wrong"
        description="This page could not be displayed. You can try again, or go back and return later."
        onRetry={unstable_retry}
      />
    </div>
  );
}
