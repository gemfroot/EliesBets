import { getConditionsByGameIds, type GameData } from "@azuro-org/toolkit";
import Link from "next/link";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard, extractMainLineOdds } from "@/components/GameCard";
import {
  CHAIN_ID,
  chunk,
  fetchGamesForLeague,
} from "@/lib/sportGames";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; country: string; league: string }>;
};

const CONDITIONS_BATCH = 40;

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchTopOddsByGameId(
  gameIds: string[],
): Promise<Map<string, ReturnType<typeof extractMainLineOdds>>> {
  const result = new Map<string, ReturnType<typeof extractMainLineOdds>>();
  if (!gameIds.length) {
    return result;
  }
  for (const batch of chunk(gameIds, CONDITIONS_BATCH)) {
    const conditions = await getConditionsByGameIds({
      chainId: CHAIN_ID,
      gameIds: batch,
    });
    const byGameId = new Map<string, typeof conditions>();
    for (const c of conditions) {
      const gid = c.game.gameId;
      const list = byGameId.get(gid);
      if (list) {
        list.push(c);
      } else {
        byGameId.set(gid, [c]);
      }
    }
    for (const gid of batch) {
      result.set(gid, extractMainLineOdds(byGameId.get(gid) ?? []));
    }
  }
  return result;
}

export default async function SportCountryLeaguePage({ params }: Props) {
  const { slug, country: countrySlug, league: leagueSlug } = await params;
  const sportTitle = titleFromSlug(slug);

  let games: GameData[] = [];
  let loadError: string | null = null;
  try {
    const fetched = await fetchGamesForLeague(slug, leagueSlug);
    games = fetched.filter((g) => g.country.slug === countrySlug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load games.";
  }

  const countryName = games[0]?.country.name ?? titleFromSlug(countrySlug);
  const leagueName = games[0]?.league.name ?? titleFromSlug(leagueSlug);

  const oddsByGameId = loadError
    ? new Map<string, ReturnType<typeof extractMainLineOdds>>()
    : await fetchTopOddsByGameId(games.map((g) => g.gameId));

  games = [...games].sort((a, b) => +a.startsAt - +b.startsAt);

  return (
    <div className="p-8">
      <p className="text-sm text-zinc-500">
        <Link href={`/sports/${slug}`} className="hover:text-zinc-300">
          {sportTitle}
        </Link>
        <span className="text-zinc-600"> · </span>
        <Link
          href={`/sports/${slug}/${countrySlug}`}
          className="hover:text-zinc-300"
        >
          {countryName}
        </Link>
        <span className="text-zinc-600"> · </span>
        <span className="text-zinc-400">{leagueName}</span>
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-50">{leagueName}</h1>
        <LeagueFavoriteButton
          sportSlug={slug}
          countrySlug={countrySlug}
          leagueSlug={leagueSlug}
          title={leagueName}
        />
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {sportTitle} · {countryName}
      </p>

      {loadError ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : games.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No games scheduled.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.gameId}>
              <GameCard
                game={game}
                topOdds={oddsByGameId.get(game.gameId) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
