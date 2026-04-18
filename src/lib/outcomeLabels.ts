/** Sports that typically use Draw (vs Tie) for a stalemate outcome. */
const SOCCER_SLUGS = new Set(["football", "soccer", "futsal"]);

export function isSoccerSport(sportSlug: string): boolean {
  return SOCCER_SLUGS.has(sportSlug.toLowerCase());
}

function shortenTeamName(name: string, maxLen: number): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

/**
 * Maps Azuro 1 / X / 2 style labels to US sportsbook–style labels (team names, Tie vs Draw).
 * Pass-through for named outcomes (e.g. Over/Under lines).
 */
export function getOutcomeDisplayLabel(
  selectionName: string,
  context: {
    sportSlug: string;
    participants: readonly { name: string }[];
  },
): string {
  const raw = selectionName.trim();
  const { sportSlug, participants } = context;
  const soccer = isSoccerSport(sportSlug);

  if (raw === "1") {
    if (participants[0]?.name) {
      return shortenTeamName(participants[0].name, 18);
    }
    return "Home";
  }
  if (raw === "2") {
    if (participants[1]?.name) {
      return shortenTeamName(participants[1].name, 18);
    }
    return "Away";
  }
  if (raw === "X" || raw.toLowerCase() === "draw") {
    return soccer ? "Draw" : "Tie";
  }
  return selectionName;
}
