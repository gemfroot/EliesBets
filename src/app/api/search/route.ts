import { searchGames } from "@azuro-org/toolkit";
import { CHAIN_ID } from "@/lib/sportGames";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return Response.json({ games: [] as const });
  }

  try {
    const res = await searchGames({
      chainId: CHAIN_ID,
      query: q,
      page: 1,
      perPage: 25,
    });
    return Response.json({ games: res.games });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
