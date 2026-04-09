"use client";

import { useRouter } from "next/navigation";
import type { Market } from "@azuro-org/toolkit";
import { MarketGroup } from "@/components/MarketGroup";
import { RetryCallout } from "@/components/RetryCallout";

export function GameDetailMarkets({
  sections,
  gameTitle,
  gameId,
  marketsError,
}: {
  sections: { title: string; markets: Market[] }[];
  gameTitle: string;
  gameId: string;
  marketsError: string | null;
}) {
  const router = useRouter();

  if (marketsError) {
    return (
      <RetryCallout
        className="mt-8"
        title="Could not load markets"
        description={marketsError}
        onRetry={() => router.refresh()}
      />
    );
  }

  if (sections.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6">
        <p className="text-sm font-medium text-zinc-200">No markets</p>
        <p className="mt-1 text-sm text-zinc-500">
          Odds are not available for this fixture yet. Try again in a few minutes or pick
          another game.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-2">
      {sections.map((section) => (
        <MarketGroup
          key={`${section.title}|${section.markets.map((m) => m.marketKey).join("|")}`}
          title={section.title}
          markets={section.markets}
          gameTitle={gameTitle}
          gameId={gameId}
        />
      ))}
    </div>
  );
}
