import { searchGames } from "@azuro-org/toolkit";
import { getSportsChainId } from "@/lib/sportsChain";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return Response.json({ games: [] as const });
  }
  if (q.length > 64) {
    return Response.json({ games: [] as const });
  }

  try {
    const chainId = await getSportsChainId();
    const res = await searchGames({
      chainId,
      query: q,
      page: 1,
      perPage: 25,
    });
    const hasGames = res.games.length > 0;
    const headers = new Headers();
    if (hasGames) {
      headers.set(
        "Cache-Control",
        "public, s-maxage=10, stale-while-revalidate=30",
      );
    }
    return Response.json({ games: res.games }, { headers });
  } catch (e) {
    console.error("[api/search]", e);
    return Response.json(
      { error: "Search failed", code: "search_failed" as const },
      { status: 500 },
    );
  }
}
