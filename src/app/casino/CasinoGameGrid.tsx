"use client";

import Link from "next/link";
import { useChainId, useConnection } from "wagmi";
import type { Address } from "viem";
import {
  getCasinoCoinTossAddress,
  getCasinoDiceAddress,
  getCasinoKenoAddress,
  getCasinoPlinkoAddress,
  getCasinoRouletteAddress,
  getCasinoWheelAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
import { chainName } from "@/lib/chains";

type GameDef = {
  icon: string;
  title: string;
  description: string;
  href: string;
  getAddress: (chainId: number) => Address;
};

const GAMES: readonly GameDef[] = [
  {
    icon: "🎲",
    title: "Dice",
    description: "Roll provably fair dice with adjustable risk and payouts.",
    href: "/casino/dice",
    getAddress: getCasinoDiceAddress,
  },
  {
    icon: "🪙",
    title: "Coin toss",
    description: "Call heads or tails and settle on-chain with your stake.",
    href: "/casino/coin-toss",
    getAddress: getCasinoCoinTossAddress,
  },
  {
    icon: "🎡",
    title: "Roulette",
    description: "Classic number bets with on-chain settlement.",
    href: "/casino/roulette",
    getAddress: getCasinoRouletteAddress,
  },
  {
    icon: "🎯",
    title: "Keno",
    description: "Pick your numbers and watch the draw unfold on-chain.",
    href: "/casino/keno",
    getAddress: getCasinoKenoAddress,
  },
  {
    icon: "🎰",
    title: "Wheel",
    description: "Spin the wheel—weighted segments, provably fair odds.",
    href: "/casino/wheel",
    getAddress: getCasinoWheelAddress,
  },
  {
    icon: "📍",
    title: "Plinko",
    description: "Drop the ball through pegs for on-chain random payouts.",
    href: "/casino/plinko",
  getAddress: getCasinoPlinkoAddress,
  },
];

export function CasinoGameGrid() {
  const { isConnected } = useConnection();
  const chainId = useChainId();

  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {GAMES.map((game) => {
        const available =
          !isConnected || isCasinoAddressConfigured(game.getAddress(chainId));

        if (available) {
          return (
            <li key={game.title} className="min-h-[11rem]">
              <Link
                href={game.href}
                className="group flex h-full min-h-[11rem] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-700/50 hover:bg-zinc-900/70"
              >
                <span className="text-3xl leading-none" aria-hidden="true">
                  {game.icon}
                </span>
                <span className="type-overline mt-3 text-emerald-400/90">Live</span>
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
            </li>
          );
        }

        return (
          <li key={game.title} className="min-h-[11rem]">
            <div
              className="flex h-full min-h-[11rem] flex-col rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-5"
              aria-disabled="true"
            >
              <span
                className="text-3xl leading-none text-zinc-500"
                aria-hidden="true"
              >
                {game.icon}
              </span>
              <span className="mt-3 inline-flex w-fit rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-0.5 type-overline text-zinc-400">
                Not on {chainName(chainId)}
              </span>
              <h2 className="type-title mt-2 text-zinc-600">{game.title}</h2>
              <p className="type-muted mt-2 flex-1 text-pretty text-zinc-600">
                {game.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
