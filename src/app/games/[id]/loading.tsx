import { GameDetailPageSkeleton, PageLoadingShell } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <GameDetailPageSkeleton />
    </PageLoadingShell>
  );
}
