import type { ReactNode } from "react";

const pulse = "animate-pulse rounded bg-zinc-800";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`${pulse} ${className}`.trim()} aria-hidden />;
}

/** Sidebar / nav: label + optional count pill */
export function SportsListRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-8 shrink-0 rounded-full" />
    </div>
  );
}

export function SportsListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5 px-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <SportsListRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Home: horizontal sport pills */
export function SportsNavSkeleton({ pills = 8 }: { pills?: number }) {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: pills }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-[4.5rem] rounded-xl" />
      ))}
    </div>
  );
}

/** Matches `GameCard` layout: title row + meta + odds row */
export function GameCardSkeleton() {
  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      aria-hidden
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <Skeleton className="h-4 w-[min(100%,18rem)]" />
            <Skeleton className="h-6 w-6 shrink-0 rounded" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex w-full gap-2 md:max-w-[min(100%,22rem)]">
          <Skeleton className="h-11 min-h-11 flex-1 rounded-md md:h-9 md:min-h-0" />
          <Skeleton className="h-11 min-h-11 flex-1 rounded-md md:h-9 md:min-h-0" />
          <Skeleton className="h-11 min-h-11 flex-1 rounded-md md:h-9 md:min-h-0" />
        </div>
      </div>
    </div>
  );
}

export function GameCardListSkeleton({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-2 ${className}`.trim()} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <GameCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Matches hero live grid: stacked names + badge row + odds row */
export function HeroLiveGameCardSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mx-auto h-3 w-6" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded" />
      </div>
      <div className="flex min-h-[1.75rem] items-center justify-center py-1">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-auto flex gap-2 pt-1">
        <Skeleton className="h-10 min-h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 min-h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 min-h-10 flex-1 rounded-md" />
      </div>
    </div>
  );
}

export function LiveGameGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="min-w-0">
          <HeroLiveGameCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function SectionHeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

/** Full home page while route segment loads */
export function HomePageSkeleton() {
  return (
    <div className="page-shell" aria-hidden>
      <section className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionHeadingSkeleton />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mt-6">
          <LiveGameGridSkeleton count={6} />
        </div>
      </section>
      <div className="mb-8">
        <Skeleton className="h-3 w-16" />
        <div className="mt-3">
          <SportsNavSkeleton pills={10} />
        </div>
      </div>
      <section className="mb-8">
        <SectionHeadingSkeleton />
        <div className="mt-6">
          <GameCardListSkeleton count={4} />
        </div>
      </section>
      <section>
        <SectionHeadingSkeleton />
        <div className="mt-6">
          <GameCardListSkeleton count={4} />
        </div>
      </section>
    </div>
  );
}

/** Live / sport country / league lists */
export function GamesListPageSkeleton({
  listItems = 8,
  showBreadcrumb = false,
}: {
  listItems?: number;
  showBreadcrumb?: boolean;
}) {
  return (
    <div className="page-shell" aria-hidden>
      {showBreadcrumb ? (
        <div className="mb-2 space-y-2">
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      ) : null}
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-8">
        <GameCardListSkeleton count={listItems} />
      </div>
    </div>
  );
}

function MarketBlockSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <Skeleton className="h-4 w-32" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-14 rounded-md" />
        <Skeleton className="h-10 w-14 rounded-md" />
        <Skeleton className="h-10 w-14 rounded-md" />
      </div>
    </div>
  );
}

export function GameDetailPageSkeleton() {
  return (
    <div className="page-shell" aria-hidden>
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="mt-3 h-9 w-[min(100%,24rem)]" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <MarketBlockSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function BetCardRowSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-full max-w-md" />
    </div>
  );
}

export function BetsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex max-w-3xl flex-col gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <BetCardRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function BetsPageSkeleton() {
  return (
    <div className="page-shell" aria-hidden>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-lg" />
        ))}
      </div>
      <div className="mt-6">
        <BetsListSkeleton count={4} />
      </div>
    </div>
  );
}

/** Wrapper for route loading files */
export function PageLoadingShell({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}
