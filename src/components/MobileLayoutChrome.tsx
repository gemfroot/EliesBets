"use client";

import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import { useSports } from "@azuro-org/sdk";
import { useBetslipMobileDrawer } from "@/components/Betslip";
import { SportNavIcon } from "@/lib/sportNavIcon";

function NavGlyph({
  children,
  className = "h-[1.125rem] w-[1.125rem] text-zinc-400",
  ...rest
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavGlyph {...props}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </NavGlyph>
  );
}

function LiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavGlyph {...props}>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41M7.05 16.95l1.41-1.41M15.54 8.46l1.41-1.41" />
    </NavGlyph>
  );
}

function SlipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavGlyph {...props}>
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H4V9Z" />
      <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M9 14h6" />
    </NavGlyph>
  );
}

export function MobileLayoutChrome() {
  const { openDrawer } = useBetslipMobileDrawer();

  return (
    <>
      <MobileBottomNav onOpenBetslip={openDrawer} />
    </>
  );
}

function MobileBottomNav({
  onOpenBetslip,
}: {
  onOpenBetslip: () => void;
}) {
  const { data: sports, isLoading, isError } = useSports({
    isLive: false,
    filter: { maxGamesPerLeague: 10 },
    sortLeaguesAndCountriesByName: true,
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
    >
      <div className="flex h-14 w-full min-w-0 items-stretch">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <HomeIcon className="h-[1.125rem] w-[1.125rem]" />
          Home
        </Link>
        <Link
          href="/live"
          className="flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <LiveIcon className="h-[1.125rem] w-[1.125rem] text-red-400/90" />
          Live
        </Link>

        <div className="flex min-h-[44px] min-w-0 flex-1 items-center overflow-x-auto overscroll-x-contain px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div
              className="mx-auto h-6 w-24 animate-pulse rounded bg-zinc-800"
              aria-hidden
            />
          ) : isError || !sports?.length ? (
            <span className="px-2 text-[10px] text-zinc-600">Sports unavailable</span>
          ) : (
            <ul className="flex w-max min-w-0 items-center gap-1 py-1">
              {sports.map((sport) => (
                <li key={sport.id}>
                  <Link
                    href={`/sports/${sport.slug}`}
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg transition hover:bg-zinc-900"
                    title={sport.name}
                    aria-label={sport.name}
                  >
                    <SportNavIcon slug={sport.slug} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenBetslip}
          className="flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 border-l border-zinc-800 px-3 text-[10px] font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
        >
          <SlipIcon className="h-[1.125rem] w-[1.125rem]" />
          Slip
        </button>
      </div>
    </nav>
  );
}
