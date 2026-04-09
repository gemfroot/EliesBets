import type { Metadata } from "next";
import { DiceGame } from "@/components/DiceGame";

export const metadata: Metadata = {
  title: "Dice",
  description:
    "On-chain dice: set your cap and stake native currency on Polygon or Gnosis. Roll under Chainlink VRF.",
};

export default function DicePage() {
  return <DiceGame />;
}
