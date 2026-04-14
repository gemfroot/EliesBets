import { CasinoGameGrid } from "./CasinoGameGrid";

export default function CasinoPage() {
  return (
    <div className="page-shell">
      <header className="max-w-3xl">
        <h1 className="type-display">Casino</h1>
        <p className="type-muted mt-2">
          Provably fair games powered by Chainlink VRF. Every result is
          verifiable on-chain.
        </p>
      </header>

      <CasinoGameGrid />
    </div>
  );
}
