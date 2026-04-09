import type { Metadata } from "next";
import { CoinTossGame } from "@/components/CoinTossGame";

export const metadata: Metadata = {
  title: "Coin toss",
  description:
    "On-chain coin toss: choose heads or tails and stake native currency on Polygon or Gnosis.",
};

export default function CoinTossPage() {
  return <CoinTossGame />;
}
