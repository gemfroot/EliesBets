"use client";

import Link from "next/link";
import { useSports } from "@azuro-org/sdk";
import { useBetslipMobileDrawer } from "@/components/Betslip";
import { sportEmoji } from "@/lib/sportEmoji";

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
          <span className="text-lg leading-none" aria-hidden>
            🏠
          </span>
          Home
        </Link>
        <Link
          href="/live"
          className="flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <span className="text-lg leading-none" aria-hidden>
            🔴
          </span>
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
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-lg transition hover:bg-zinc-900"
                    title={sport.name}
                    aria-label={sport.name}
                  >
                    <span aria-hidden>{sportEmoji(sport.slug)}</span>
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
          <span className="text-lg leading-none" aria-hidden>
            🎫
          </span>
          Slip
        </button>
      </div>
    </nav>
  );
}
