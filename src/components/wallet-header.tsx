"use client";

import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { useCallback, useEffect, useRef, useState } from "react";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletHeader() {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { address, isConnected, status } = useConnection();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const { connect, isPending, error, reset } = useConnect({
    mutation: {
      onSuccess: () => setOpen(false),
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const onConnect = useCallback(
    (connector: (typeof connectors)[number]) => {
      reset();
      connect({ connector });
    },
    [connect, reset],
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {isConnected && address ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
            {formatAddress(address)}
          </span>
          <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={status === "connecting" || isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {status === "connecting" || isPending ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
          role="presentation"
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
          >
            <h2
              id="wallet-modal-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Connect a wallet
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Choose MetaMask, another injected wallet, or WalletConnect.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {connectors.map((connector) => (
                <li key={connector.uid}>
                  <button
                    type="button"
                    onClick={() => onConnect(connector)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {connector.name}
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {error.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
