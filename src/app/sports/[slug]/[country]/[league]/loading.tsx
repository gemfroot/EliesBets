import { GamesListPageSkeleton, PageLoadingShell } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <GamesListPageSkeleton listItems={8} showBreadcrumb />
    </PageLoadingShell>
  );
}
