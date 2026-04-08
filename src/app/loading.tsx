import { HomePageSkeleton, PageLoadingShell } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <HomePageSkeleton />
    </PageLoadingShell>
  );
}
