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
        <p className="leading-relaxed text-zinc-600">
          Responsible gambling: Betting involves risk and can be addictive. Only
          wager money you can afford to lose. If gambling is causing problems for
          you or someone you know, seek help from local support services.
        </p>
      </div>
    </footer>
  );
}
