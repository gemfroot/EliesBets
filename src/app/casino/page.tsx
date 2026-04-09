import Link from "next/link";

type GameCard =
  | {
      status: "live";
      title: string;
      description: string;
      href: string;
    }
  | {
      status: "soon";
      title: string;
      description: string;
    };

const GAMES: readonly GameCard[] = [
  {
    status: "live",
    title: "Coin toss",
    description: "Call heads or tails and settle on-chain with your stake.",
    href: "/casino/coin-toss",
  },
  {
    status: "soon",
    title: "Dice",
    description: "Roll provably fair dice with adjustable risk and payouts.",
  },
  {
    status: "soon",
    title: "Roulette",
    description: "Classic wheel action with on-chain settlement.",
  },
  {
    status: "soon",
    title: "Slots",
    description: "Spin the reels—wallet-native play when this title ships.",
  },
];

export default function CasinoPage() {
  return (
    <div className="page-shell">
      <header className="max-w-3xl">
        <h1 className="type-display">Casino</h1>
        <p className="type-muted mt-2">
          Wallet games on Polygon and Gnosis. Pick a table below—more titles
          ship on-chain as we roll them out.
        </p>
      </header>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAMES.map((game) => (
          <li key={game.title} className="min-h-[11rem]">
            {game.status === "live" ? (
              <Link
                href={game.href}
                className="group flex h-full min-h-[11rem] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-700/50 hover:bg-zinc-900/70"
              >
                <span className="type-overline text-emerald-400/90">Live</span>
                <h2 className="type-title mt-2 group-hover:text-zinc-50">
                  {game.title}
                </h2>
                <p className="type-muted mt-2 flex-1 text-pretty">
                  {game.description}
                </p>
                <span className="type-caption mt-4 text-emerald-400/90 transition group-hover:text-emerald-300">
                  Play →
                </span>
              </Link>
            ) : (
              <div
                className="flex h-full min-h-[11rem] flex-col rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-5"
                aria-disabled="true"
              >
                <span className="type-overline text-zinc-600">Soon</span>
                <h2 className="type-title mt-2 text-zinc-600">{game.title}</h2>
                <p className="type-muted mt-2 flex-1 text-pretty text-zinc-600">
                  {game.description}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
