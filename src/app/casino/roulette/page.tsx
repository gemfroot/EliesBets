import type { Metadata } from "next";
import { RouletteGame } from "@/components/RouletteGame";

export const metadata: Metadata = {
  title: "Roulette",
  description:
    "On-chain roulette: pick numbers or presets and stake native currency on Polygon or Gnosis. Settled with Chainlink VRF.",
};

export default function RoulettePage() {
  return <RouletteGame />;
}
