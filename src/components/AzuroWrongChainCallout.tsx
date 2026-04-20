"use client";

type AzuroWrongChainCalloutProps = {
  appChainName: string;
  walletChainName: string;
  switchPending: boolean;
  onSwitch: () => void;
};

export function AzuroWrongChainCallout({
  appChainName,
  walletChainName,
  switchPending,
  onSwitch,
}: AzuroWrongChainCalloutProps) {
  return (
    <div className="mb-2 rounded-md border border-amber-800/50 bg-amber-950/50 px-3 py-2 text-xs leading-snug text-amber-100">
      <p>
        Your wallet is on <strong>{walletChainName}</strong>, but this bet is on{" "}
        <strong>{appChainName}</strong>. Claim and cash out only work after your wallet
        matches that network.
      </p>
      <button
        type="button"
        disabled={switchPending}
        onClick={() => void onSwitch()}
        className="mt-2 rounded-md border border-amber-600/80 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {switchPending ? "Switching…" : `Switch wallet to ${appChainName}`}
      </button>
    </div>
  );
}
