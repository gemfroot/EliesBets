import { getConditionsByGameIds, type GameData } from "@azuro-org/toolkit";
import Link from "next/link";
import { LeagueFavoriteButton } from "@/components/FavoriteButton";
import { GameCard } from "@/components/GameCard";
import { extractMainLineOdds } from "@/lib/oddsUtils";
import { RetryCallout } from "@/components/RetryCallout";
import { CHAIN_ID } from "@/lib/constants";
import { chunk, fetchGamesForLeague } from "@/lib/sportGames";

export const revalidate = 45;

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
    <div className="page-shell">
      <p className="type-muted">
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
      <div className="mt-2 flex items-start justify-between gap-2">
        <h1 className="type-display">{leagueName}</h1>
        <LeagueFavoriteButton
          sportSlug={slug}
          countrySlug={countrySlug}
          leagueSlug={leagueSlug}
          title={leagueName}
        />
      </div>
      <p className="type-muted mt-1">
        {sportTitle} · {countryName}
      </p>

      {loadError ? (
        <RetryCallout
          className="mt-6"
          title="Could not load games"
          description={loadError}
        />
      ) : games.length === 0 ? (
        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6">
          <p className="text-sm font-medium text-zinc-200">No games</p>
          <p className="mt-1 text-sm text-zinc-500">
            This league has no upcoming fixtures. Try another league or check back later.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
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
