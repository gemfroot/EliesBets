import type { Metadata } from "next";
import { KenoGame } from "@/components/KenoGame";

export const metadata: Metadata = {
  title: "Keno",
  description:
    "On-chain keno: pick your numbers, stake native currency on Polygon or Gnosis, and draw with Chainlink VRF.",
};

export default function KenoPage() {
  return <KenoGame />;
}
