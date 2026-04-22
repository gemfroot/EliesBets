import { GameState, getSports, type SportData } from "@azuro-org/toolkit";
import type { MetadataRoute } from "next";
import { HEADER_SWITCHER_CHAIN_IDS } from "@/lib/chains";
import {
  CHAIN_SLUG_BY_ID,
  CHAIN_SLUGS,
  DEFAULT_CHAIN_SLUG,
} from "@/lib/sportsChainConstants";
import { getSiteOrigin } from "@/lib/siteUrl";

/** Large enough to list most fixtures per league in the sitemap tree response. */
const SITEMAP_GAMES_PER_LEAGUE = 500;

export const revalidate = 3600;

function mergeSportsTrees(parts: SportData[][]): SportData[] {
  const bySlug = new Map<string, SportData>();
  for (const sports of parts) {
    for (const s of sports) {
      const existing = bySlug.get(s.slug);
      if (!existing) {
        bySlug.set(s.slug, s);
        continue;
      }
      const countryBySlug = new Map(
        existing.countries.map((c) => [c.slug, { ...c, leagues: [...c.leagues] }]),
      );
      for (const c of s.countries) {
        const cur = countryBySlug.get(c.slug);
        if (!cur) {
          countryBySlug.set(c.slug, { ...c, leagues: [...c.leagues] });
          continue;
        }
        const leagueBySlug = new Map(cur.leagues.map((l) => [l.slug, { ...l, games: [...l.games] }]));
        for (const l of c.leagues) {
          const lg = leagueBySlug.get(l.slug);
          if (!lg) {
            leagueBySlug.set(l.slug, { ...l, games: [...l.games] });
          } else {
            lg.games.push(...l.games);
          }
        }
        cur.leagues = [...leagueBySlug.values()];
      }
      existing.countries = [...countryBySlug.values()];
    }
  }
  return [...bySlug.values()];
}

function collectFromSports(sports: SportData[]): {
  sportPaths: string[];
  countryPaths: string[];
  leaguePaths: string[];
  gameIds: string[];
} {
  const sportSet = new Set<string>();
  const countrySet = new Set<string>();
  const leagueSet = new Set<string>();
  const gameSet = new Set<string>();

  for (const s of sports) {
    sportSet.add(s.slug);
    for (const c of s.countries) {
      countrySet.add(`${s.slug}/${c.slug}`);
      for (const l of c.leagues) {
        leagueSet.add(`${s.slug}/${c.slug}/${l.slug}`);
        for (const g of l.games) {
          gameSet.add(g.gameId);
        }
      }
    }
  }

  return {
    sportPaths: [...sportSet].sort(),
    countryPaths: [...countrySet].sort(),
    leaguePaths: [...leagueSet].sort(),
    gameIds: [...gameSet].sort(),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const base: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "hourly", priority: 1 },
    ...CHAIN_SLUGS.map((slug) => ({
      url: `${origin}/${slug}`,
      changeFrequency: "hourly" as const,
      priority: slug === DEFAULT_CHAIN_SLUG ? 1 : 0.95,
    })),
    ...CHAIN_SLUGS.map((slug) => ({
      url: `${origin}/${slug}/live`,
      changeFrequency: "always" as const,
      priority: 0.9,
    })),
    { url: `${origin}/bets`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.35 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.35 },
  ];

  const perChainCollected: { chainSlug: string; sports: SportData[] }[] = [];
  try {
    const perChainTrees = await Promise.all(
      HEADER_SWITCHER_CHAIN_IDS.map(async (chainId) => {
        const [prematch, live] = await Promise.all([
          getSports({
            chainId,
            gameState: GameState.Prematch,
            numberOfGames: SITEMAP_GAMES_PER_LEAGUE,
          }),
          getSports({
            chainId,
            gameState: GameState.Live,
            numberOfGames: SITEMAP_GAMES_PER_LEAGUE,
          }),
        ]);
        return {
          chainSlug: CHAIN_SLUG_BY_ID[chainId],
          sports: mergeSportsTrees([prematch, live]),
        };
      }),
    );
    perChainCollected.push(...perChainTrees);
  } catch {
    return base;
  }

  const gameIdAll = new Set<string>();
  for (const { chainSlug, sports } of perChainCollected) {
    const { sportPaths, countryPaths, leaguePaths, gameIds } =
      collectFromSports(sports);
    for (const id of gameIds) gameIdAll.add(id);
    for (const slug of sportPaths) {
      base.push({
        url: `${origin}/${chainSlug}/sports/${slug}`,
        changeFrequency: "hourly",
        priority: 0.85,
      });
    }
    for (const path of countryPaths) {
      base.push({
        url: `${origin}/${chainSlug}/sports/${path}`,
        changeFrequency: "hourly",
        priority: 0.75,
      });
    }
    for (const path of leaguePaths) {
      base.push({
        url: `${origin}/${chainSlug}/sports/${path}`,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }
  }
  // Game pages are still at `/games/<id>` (cookie-scoped route kept for now).
  for (const id of gameIdAll) {
    base.push({
      url: `${origin}/games/${id}`,
      changeFrequency: "hourly",
      priority: 0.65,
    });
  }

  return base;
}
