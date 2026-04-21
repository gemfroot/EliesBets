/**
 * Short, user-safe copy for server fetches, RSC failures, and non-wallet HTTP errors.
 * Never surfaces raw subgraph or stack text to the UI.
 */
export function formatServerFetchError(error: unknown): string {
  if (error == null) {
    return "Could not load this content. Try again in a moment.";
  }
  const name =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : "";
  if (name === "AbortError") {
    return "Request was cancelled.";
  }

  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const t = msg.toLowerCase();
  if (
    t.includes("429") ||
    t.includes("rate limit") ||
    t.includes("too many requests")
  ) {
    return "The service is busy. Wait a few seconds and try again.";
  }
  if (
    t.includes("failed to fetch") ||
    t.includes("networkerror") ||
    t.includes("network request failed") ||
    t.includes("load failed") ||
    t.includes("econnrefused") ||
    t.includes("enotfound")
  ) {
    return "Could not reach the games feed. Check your connection and try again.";
  }
  if (t.includes("timeout") || t.includes("timed out")) {
    return "The request timed out. Try again.";
  }

  return "Could not load this content. Try again in a moment.";
}
