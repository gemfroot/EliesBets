import type { GameData } from "@azuro-org/toolkit";

/** Human-readable matchup line for headings and document titles. */
export function gameParticipantLine(game: GameData): string {
  const { participants, title } = game;
  if (participants.length >= 2) {
    return `${participants[0]!.name} vs ${participants[1]!.name}`;
  }
  if (participants.length === 1) {
    return participants[0]!.name;
  }
  return title;
}
