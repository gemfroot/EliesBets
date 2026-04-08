import { BetsPageSkeleton, PageLoadingShell } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <BetsPageSkeleton />
    </PageLoadingShell>
  );
}
