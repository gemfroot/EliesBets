import Link from "next/link";

export default function CasinoPage() {
  return (
    <div className="page-shell">
      <h1 className="type-display">Casino</h1>
      <p className="type-muted mt-1">
        Wallet games on Polygon and Gnosis. More games coming soon.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link
            href="/casino/coin-toss"
            className="group flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-700/50 hover:bg-zinc-900/70"
          >
            <span className="type-overline text-emerald-400/90">Live</span>
            <h2 className="type-title mt-2 group-hover:text-zinc-50">Coin toss</h2>
            <p className="type-muted mt-2 flex-1">
              Call heads or tails and settle on-chain with your stake.
            </p>
            <span className="type-caption mt-4 text-emerald-400/90 transition group-hover:text-emerald-300">
              Play →
            </span>
          </Link>
        </li>
        <li>
          <div
            className="flex h-full flex-col rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-5"
            aria-disabled="true"
          >
            <span className="type-overline text-zinc-600">Soon</span>
            <h2 className="type-title mt-2 text-zinc-600">More games</h2>
            <p className="type-muted mt-2 flex-1 text-zinc-600">
              Additional casino titles will appear here.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
