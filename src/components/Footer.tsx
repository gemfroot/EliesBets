import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="shrink-0 border-t border-zinc-800 bg-zinc-950/80 px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-6 md:px-6 md:pb-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 text-center text-xs text-zinc-500">
        <p>
          Markets and settlement powered by{" "}
          <Link
            href="https://azuro.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-400/90 hover:decoration-amber-500/50"
          >
            Azuro
          </Link>
          .
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span
            className="inline-flex shrink-0 items-center justify-center rounded border border-zinc-600 px-2 py-0.5 font-semibold tabular-nums text-zinc-400"
            aria-label="Adults only"
          >
            18+
          </span>
          <span className="text-zinc-600">Helplines:</span>
          <Link
            href="https://www.begambleaware.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-400/90 hover:decoration-amber-500/50"
          >
            BeGambleAware
          </Link>
          <span className="hidden text-zinc-700 sm:inline" aria-hidden>
            ·
          </span>
          <Link
            href="https://www.gamblersanonymous.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-400/90 hover:decoration-amber-500/50"
          >
            Gamblers Anonymous
          </Link>
          <span className="hidden text-zinc-700 sm:inline" aria-hidden>
            ·
          </span>
          <Link
            href="https://www.ncpgambling.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-400/90 hover:decoration-amber-500/50"
          >
            NCPG (US)
          </Link>
        </div>
        <p className="leading-relaxed text-zinc-600">
          Responsible gambling: Betting involves risk and can be addictive. Only
          wager money you can afford to lose. If gambling is causing problems for
          you or someone you know, seek help from local support services.
        </p>
      </div>
    </footer>
  );
}
