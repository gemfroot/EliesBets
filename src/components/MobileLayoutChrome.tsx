"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { useSports } from "@azuro-org/sdk";
import { useBetslipMobileDrawer } from "@/components/Betslip";
import { FavoritesNav } from "@/components/FavoritesNav";
import { MyBetsLink } from "@/components/MyBetsLink";
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

function CasinoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavGlyph {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.25" />
      <rect x="13" y="13" width="7" height="7" rx="1.25" />
      <circle cx="7.5" cy="7.5" r="0.9" fill="currentColor" />
      <circle cx="16.5" cy="16.5" r="0.9" fill="currentColor" />
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

function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavGlyph {...props}>
      <path d="M12 3.5 14.09 8.26 19.5 9.1 15.5 12.74 16.5 18.5 12 15.77 7.5 18.5 8.5 12.74 4.5 9.1 9.91 8.26 12 3.5Z" />
    </NavGlyph>
  );
}

function MobileFavoritesDrawer({
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close favorites"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 flex max-h-[min(85vh,32rem)] flex-col rounded-t-xl border border-b-0 border-zinc-700 bg-zinc-900 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Favorites"
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">Favorites</p>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <FavoritesNav variant="sheet" onFavoriteNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

export function MobileLayoutChrome() {
  const { openDrawer } = useBetslipMobileDrawer();
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  return (
    <>
      <MobileBottomNav
        onOpenBetslip={openDrawer}
        favoritesOpen={favoritesOpen}
        onToggleFavorites={() => setFavoritesOpen((v) => !v)}
      />
      <MobileFavoritesDrawer
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
      />
    </>
  );
}

function MobileBottomNav({
  onOpenBetslip,
  favoritesOpen,
  onToggleFavorites,
}: {
  onOpenBetslip: () => void;
  favoritesOpen: boolean;
  onToggleFavorites: () => void;
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

        <Link
          href="/casino"
          className="flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <CasinoIcon className="h-[1.125rem] w-[1.125rem] text-emerald-400/90" />
          Casino
        </Link>

        <MyBetsLink variant="mobile" />

        <button
          type="button"
          onClick={onToggleFavorites}
          className={`flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium transition hover:text-zinc-100 ${
            favoritesOpen
              ? "text-amber-400"
              : "text-zinc-400"
          }`}
          aria-label="Favorites"
          aria-expanded={favoritesOpen}
        >
          <StarIcon className="h-[1.125rem] w-[1.125rem]" />
          Favs
        </button>

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
