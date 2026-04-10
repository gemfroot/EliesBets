import type { Metadata } from "next";
import { PlinkoGame } from "@/components/PlinkoGame";

export const metadata: Metadata = {
  title: "Plinko",
  description:
    "Drop the ball through pegs for on-chain multiplier payouts. Settled with Chainlink VRF on Polygon or Gnosis.",
};

export default function PlinkoPage() {
  return <PlinkoGame />;
}
