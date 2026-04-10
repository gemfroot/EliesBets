import type { Metadata } from "next";
import { WheelGame } from "@/components/WheelGame";

export const metadata: Metadata = {
  title: "Wheel",
  description:
    "On-chain prize wheel: pick a layout, stake native currency on Polygon or Gnosis, and spin. Settled with Chainlink VRF.",
};

export default function WheelPage() {
  return <WheelGame />;
}
