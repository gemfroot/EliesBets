import { PageLoadingShell } from "@/components/Skeleton";

/** Lightweight shell so the initial route paint is not blocked by the full home skeleton. */
export default function Loading() {
  return (
    <PageLoadingShell>
      <div
        className="page-shell min-h-[40vh] animate-pulse rounded-lg bg-zinc-900/20"
        aria-hidden
      />
    </PageLoadingShell>
  );
}
