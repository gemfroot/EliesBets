"use client";

import Link from "next/link";
import { useSports } from "@azuro-org/sdk";
import { useCallback, useEffect, useState } from "react";
import { BetslipPanel } from "@/components/Betslip";
import { sportEmoji } from "@/lib/sportEmoji";

export function MobileLayoutChrome() {
  const [betslipOpen, setBetslipOpen] = useState(false);

  const onClose = useCallback(() => setBetslipOpen(false), []);

  useEffect(() => {
    if (!betslipOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [betslipOpen]);

  return (
    <>
      <MobileBottomNav onOpenBetslip={() => setBetslipOpen(true)} />
      <BetslipSlideUp open={betslipOpen} onClose={onClose} />
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

function BetslipSlideUp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Betslip">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close betslip"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] flex max-h-[100dvh] flex-col rounded-t-2xl border border-zinc-700 border-b-0 bg-zinc-900 shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">Betslip</p>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-2">
          <BetslipPanel />
        </div>
      </div>
    </div>
  );
}
