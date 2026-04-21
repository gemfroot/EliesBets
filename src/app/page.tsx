import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
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

// Home sections call `getSportsChainId()` (cookies) → dynamic; `revalidate` would not apply as ISR.

async function LiveHeroSection() {
  unstable_noStore();
  return <HomeHeroSection />;
}

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

export default function Home() {
  return (
    <div className="page-shell">
      <Suspense fallback={<HomeHeroFallback />}>
        <LiveHeroSection />
      </Suspense>

      <Suspense fallback={<HomeSportsNavFallback />}>
        <HomeSportsNavSection />
      </Suspense>

      <Suspense fallback={<HomePopularUpcomingFallback />}>
        <HomePopularUpcomingSections />
      </Suspense>
    </div>
  );
}
