import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getConditionsByGameIds,
  getGamesByIds,
  groupConditionsByMarket,
  type GameData,
  type GameMarkets,
  type Market,
} from "@azuro-org/toolkit";
import { GameDetailMarkets } from "@/components/GameDetailMarkets";
import { GameDetailStatus } from "@/components/GameDetailStatus";
import { RetryCallout } from "@/components/RetryCallout";
import { gameParticipantLine } from "@/lib/gameTitle";
import { formatServerFetchError } from "@/lib/serverFetchError";
import { getSportsChainId } from "@/lib/sportsChain";
import { isSoccerSport } from "@/lib/outcomeLabels";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chainId = await getSportsChainId();
  try {
    const games = await getGamesByIds({ chainId, gameIds: [id] });
    const game = games[0];
    if (!game) {
      return { title: "Game" };
    }
    const line = gameParticipantLine(game);
    return {
      title: line,
      description: `${line} — ${game.sport.name}, ${game.league.name}. Odds and markets on EliesBets.`,
    };
  } catch {
    return { title: "Game" };
  }
}

/** First segment of Azuro `marketKey` (e.g. "1-1-1" → "1"). */
function marketFamilyKey(marketKey: string): string {
  const i = marketKey.indexOf("-");
  return i === -1 ? marketKey : marketKey.slice(0, i);
}

const FAMILY_LABEL: Record<string, string> = {
  "1": "Match result",
  "2": "Double Chance",
  "3": "Handicap",
  "4": "Totals",
  "7": "Team Totals",
  "9": "Both Teams To Score",
  "16": "Team To Score",
  "18": "European Handicap",
  "19": "Winner",
  "25": "Next Goal",
  "26": "Result & BTTS",
  "27": "BTTS & Total",
  "28": "Result & Total",
  "29": "Winner & Total",
};

const FAMILY_SORT_ORDER: string[] = [
  "1",
  "2",
  "19",
  "18",
  "3",
  "4",
  "7",
  "9",
  "16",
  "25",
  "26",
  "27",
  "28",
  "29",
];

function sectionTitle(
  family: string,
  markets: Market[],
  sportSlug: string,
): string {
  if (family === "1") {
    return isSoccerSport(sportSlug) ? "Match result (1X2)" : "Moneyline (3-way)";
  }
  if (family === "4") {
    return "Totals (Over / Under)";
  }
  return FAMILY_LABEL[family] ?? markets[0]?.name ?? "Markets";
}

function groupMarketsForUi(
  markets: GameMarkets,
  sportSlug: string,
): { title: string; markets: Market[] }[] {
  const byFamily = new Map<string, Market[]>();
  for (const m of markets) {
    const fam = marketFamilyKey(m.marketKey);
    const list = byFamily.get(fam);
    if (list) {
      list.push(m);
    } else {
      byFamily.set(fam, [m]);
    }
  }

  const keys = [...byFamily.keys()];
  const orderIndex = new Map(FAMILY_SORT_ORDER.map((k, i) => [k, i]));
  keys.sort((a, b) => {
    const ia = orderIndex.get(a) ?? 999;
    const ib = orderIndex.get(b) ?? 999;
    if (ia !== ib) {
      return ia - ib;
    }
    return a.localeCompare(b);
  });

  return keys.map((family) => {
    const ms = byFamily.get(family)!;
    return { title: sectionTitle(family, ms, sportSlug), markets: ms };
  });
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const chainId = await getSportsChainId();

  let game: GameData | undefined;
  let gameFetchError: string | null = null;
  try {
    const games = await getGamesByIds({ chainId, gameIds: [id] });
    game = games[0];
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[GameDetailPage] getGamesByIds", e);
    }
    gameFetchError = formatServerFetchError(e);
  }

  if (gameFetchError) {
    return (
      <div className="page-shell">
        <RetryCallout
          className="mt-8"
          title="Could not load game"
          description={gameFetchError}
        />
      </div>
    );
  }

  if (!game) {
    notFound();
  }

  let conditions: Awaited<ReturnType<typeof getConditionsByGameIds>> = [];
  let marketsError: string | null = null;
  try {
    conditions = await getConditionsByGameIds({ chainId, gameIds: id });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[GameDetailPage] getConditionsByGameIds", e);
    }
    marketsError = formatServerFetchError(e);
  }

  const markets = groupConditionsByMarket(conditions);
  const sections = groupMarketsForUi(markets, game.sport.slug);

  const names = gameParticipantLine(game);

  return (
    <div className="page-shell">
      <p className="type-muted">
        <Link href={`/sports/${game.sport.slug}`} className="hover:text-zinc-300">
          {game.sport.name}
        </Link>
        <span className="text-zinc-600"> · </span>
        <Link
          href={`/sports/${game.sport.slug}/${game.country.slug}`}
          className="hover:text-zinc-300"
        >
          {game.country.name}
        </Link>
        <span className="text-zinc-600"> · </span>
        <Link
          href={`/sports/${game.sport.slug}/${game.country.slug}/${game.league.slug}`}
          className="hover:text-zinc-300"
        >
          {game.league.name}
        </Link>
      </p>
      <h1 className="type-display mt-2">{names}</h1>
      <GameDetailStatus
        gameId={game.gameId}
        sportId={game.sport.sportId}
        sportSlug={game.sport.slug}
        state={game.state}
        startsAt={game.startsAt}
      />

      <GameDetailMarkets
        sections={sections}
        gameId={game.gameId}
        gameTitle={names}
        sportSlug={game.sport.slug}
        participants={game.participants}
        marketsError={marketsError}
      />
    </div>
  );
}
