"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { useWalletChainId } from "@/lib/useWalletChainId";
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
import {
  GAME_PREFERRED_CHAINS,
  chainName,
} from "@/lib/chains";

type GameKey =
  | "coinToss"
  | "dice"
  | "roulette"
  | "keno"
  | "wheel"
  | "plinko";

type GameDef = {
  key: GameKey;
  icon: string;
  title: string;
  description: string;
  href: string;
  getAddress: (chainId: number) => Address;
};

const GAMES: readonly GameDef[] = [
  {
    key: "dice",
    icon: "🎲",
    title: "Dice",
    description: "Roll provably fair dice with adjustable risk and payouts.",
    href: "/casino/dice",
    getAddress: getCasinoDiceAddress,
  },
  {
    key: "coinToss",
    icon: "🪙",
    title: "Coin toss",
    description: "Call heads or tails and settle on-chain with your stake.",
    href: "/casino/coin-toss",
    getAddress: getCasinoCoinTossAddress,
  },
  {
    key: "roulette",
    icon: "🎡",
    title: "Roulette",
    description: "Classic number bets with on-chain settlement.",
    href: "/casino/roulette",
    getAddress: getCasinoRouletteAddress,
  },
  {
    key: "keno",
    icon: "🎯",
    title: "Keno",
    description: "Pick your numbers and watch the draw unfold on-chain.",
    href: "/casino/keno",
    getAddress: getCasinoKenoAddress,
  },
  {
    key: "wheel",
    icon: "🎰",
    title: "Wheel",
    description: "Spin the wheel—weighted segments, provably fair odds.",
    href: "/casino/wheel",
    getAddress: getCasinoWheelAddress,
  },
  {
    key: "plinko",
    icon: "📍",
    title: "Plinko",
    description: "Drop the ball through pegs for on-chain random payouts.",
    href: "/casino/plinko",
    getAddress: getCasinoPlinkoAddress,
  },
];

function GameSkeleton() {
  return (
    <div
      className="flex h-full min-h-[11rem] animate-pulse flex-col rounded-xl border border-zinc-800 bg-zinc-900/20 p-5"
      aria-hidden="true"
    >
      <div className="h-8 w-8 rounded-md bg-zinc-800/70" />
      <div className="mt-3 h-3 w-12 rounded bg-zinc-800/70" />
      <div className="mt-2 h-5 w-24 rounded bg-zinc-800/70" />
      <div className="mt-3 h-3 w-full rounded bg-zinc-800/50" />
      <div className="mt-1.5 h-3 w-3/4 rounded bg-zinc-800/50" />
    </div>
  );
}

export function CasinoGameGrid() {
  const { isConnected } = useConnection();
  const chainId = useWalletChainId();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration guard
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAMES.map((g) => (
          <li key={g.title} className="min-h-[11rem]">
            <GameSkeleton />
          </li>
        ))}
      </ul>
    );
  }

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

        const preferredList = (
          GAME_PREFERRED_CHAINS as unknown as Partial<
            Record<GameKey, readonly (typeof GAME_PREFERRED_CHAINS)["coinToss"][number][]>
          >
        )[game.key];
        const preferred = preferredList?.[0];
        // No preferred chain at all → the game isn't deployed anywhere yet.
        // Show it as "Coming soon" instead of nudging the user to a chain
        // where it would also be unavailable (or, worse, land against an
        // upstream house we don't control).
        const comingSoon = !preferred;
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
                {comingSoon ? "Coming soon" : `Not on ${chainName(chainId)}`}
              </span>
              <h2 className="type-title mt-2 text-zinc-600">{game.title}</h2>
              <p className="type-muted mt-2 flex-1 text-pretty text-zinc-600">
                {game.description}
              </p>
              {preferred ? (
                <button
                  type="button"
                  disabled={switchPending}
                  onClick={() => switchChain?.({ chainId: preferred })}
                  className="mt-4 w-fit rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 type-caption text-zinc-300 transition hover:border-emerald-700/50 hover:text-emerald-300 disabled:opacity-60"
                >
                  Switch to {chainName(preferred)} →
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
