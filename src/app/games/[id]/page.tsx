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

export const dynamic = "force-dynamic";

const CHAIN_ID = 137 as const;

type Props = {
  params: Promise<{ id: string }>;
};

function formatStartTime(startsAt: string): string {
  const ms = +startsAt < 32_503_680_000 ? +startsAt * 1000 : +startsAt;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function participantLine(game: GameData): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}

/** First segment of Azuro `marketKey` (e.g. "1-1-1" → "1"). */
function marketFamilyKey(marketKey: string): string {
  const i = marketKey.indexOf("-");
  return i === -1 ? marketKey : marketKey.slice(0, i);
}

const FAMILY_LABEL: Record<string, string> = {
  "1": "1X2",
  "2": "Double Chance",
  "3": "Handicap",
  "4": "Over / Under",
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

function sectionTitle(family: string, markets: Market[]): string {
  return FAMILY_LABEL[family] ?? markets[0]?.name ?? "Markets";
}

function groupMarketsForUi(markets: GameMarkets): { title: string; markets: Market[] }[] {
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
    return { title: sectionTitle(family, ms), markets: ms };
  });
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;

  let game: GameData | undefined;
  try {
    const games = await getGamesByIds({ chainId: CHAIN_ID, gameIds: [id] });
    game = games[0];
  } catch {
    notFound();
  }

  if (!game) {
    notFound();
  }

  let conditions: Awaited<ReturnType<typeof getConditionsByGameIds>> = [];
  let marketsError: string | null = null;
  try {
    conditions = await getConditionsByGameIds({ chainId: CHAIN_ID, gameIds: id });
  } catch (e) {
    marketsError =
      e instanceof Error ? e.message : "Failed to load markets for this game.";
  }

  const markets = groupConditionsByMarket(conditions);
  const sections = groupMarketsForUi(markets);

  const names = participantLine(game);
  const when = formatStartTime(game.startsAt);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <p className="text-sm text-zinc-500">
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
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{names}</h1>
      <p className="mt-1 text-sm tabular-nums text-zinc-500">{when}</p>

      <GameDetailMarkets
        sections={sections}
        gameTitle={names}
        marketsError={marketsError}
      />
    </div>
  );
}
