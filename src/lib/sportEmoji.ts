/** Emoji shown for a sport slug in compact UI (nav, chips). */
export function sportEmoji(slug: string): string {
  const map: Record<string, string> = {
    football: "⚽",
    soccer: "⚽",
    basketball: "🏀",
    tennis: "🎾",
    "ice-hockey": "🏒",
    hockey: "🏒",
    "american-football": "🏈",
    baseball: "⚾",
    "counter-strike": "🎮",
    esports: "🎮",
    mma: "🥊",
    boxing: "🥊",
    volleyball: "🏐",
    handball: "🤾",
    rugby: "🏉",
    cricket: "🏏",
    darts: "🎯",
    snooker: "🎱",
    futsal: "⚽",
  };
  return map[slug] ?? "🏅";
}
