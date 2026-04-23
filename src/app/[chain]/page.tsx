import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  GameCardListSkeleton,
  LiveGameGridSkeleton,
  SectionHeadingSkeleton,
  SportsNavSkeleton,
} from "@/components/Skeleton";
import {
  HomeHeroSection,
  HomePopularUpcomingSections,
  HomeSportsNavSection,
} from "@/components/HomePageSections";
import { isChainSlug } from "@/lib/sportsChainConstants";
import { OddsRefreshControls } from "@/components/OddsRefreshControls";

/**
 * Home lists are per-chain prematch/popular data — ISR at 20s, matching the
 * client-side OddsRefreshControls tick so auto-refresh sees fresh data.
 * The hero (live) still refreshes via its own `unstable_cache` at 15s and
 * streams behind its own Suspense boundary so the shell paints immediately.
 */
export const revalidate = 20;

function HomeHeroFallback() {
  return (
    <section className="mb-8" aria-hidden>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionHeadingSkeleton />
        <div className="h-5 w-28 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="mt-6">
        <LiveGameGridSkeleton count={6} />
      </div>
    </section>
  );
}

function HomeSportsNavFallback() {
  return (
    <div className="mb-8" aria-hidden>
      <SportsNavSkeleton pills={10} />
    </div>
  );
}

function HomePopularUpcomingFallback() {
  return (
    <>
      <section className="mb-8" aria-hidden>
        <SectionHeadingSkeleton />
        <div className="mt-6">
          <GameCardListSkeleton count={4} />
        </div>
      </section>
      <section aria-hidden>
        <SectionHeadingSkeleton />
        <div className="mt-6">
          <GameCardListSkeleton count={4} />
        </div>
      </section>
    </>
  );
}

type Props = {
  params: Promise<{ chain: string }>;
};

export default async function Home({ params }: Props) {
  const { chain } = await params;
  if (!isChainSlug(chain)) {
    notFound();
  }
  return (
    <div className="page-shell">
      <OddsRefreshControls />
      <Suspense fallback={<HomeHeroFallback />}>
        <HomeHeroSection chain={chain} />
      </Suspense>

      <Suspense fallback={<HomeSportsNavFallback />}>
        <HomeSportsNavSection chain={chain} />
      </Suspense>

      <Suspense fallback={<HomePopularUpcomingFallback />}>
        <HomePopularUpcomingSections chain={chain} />
      </Suspense>
    </div>
  );
}
