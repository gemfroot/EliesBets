"use client";

import { useConnect, useConnectors } from "wagmi";
import { formatWalletTxError } from "@/lib/userFacingTxError";
import { useCallback, useEffect, useRef } from "react";

type ConnectModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ConnectModal({ open, onClose }: ConnectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const connectors = useConnectors();
  const { connect, isPending, error, reset } = useConnect({
    mutation: {
      onSuccess: () => onClose(),
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onClose]);

  const onPickConnector = useCallback(
    (connector: (typeof connectors)[number]) => {
      reset();
      connect({ connector });
    },
    [connect, reset],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      role="presentation"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
      >
        <h2
          id="wallet-modal-title"
          className="text-lg font-semibold text-zinc-50"
        >
          Connect a wallet
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose your wallet to continue. Injected wallets, MetaMask, and
          WalletConnect are supported when configured.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {connectors.map((connector) => (
            <li key={connector.uid}>
              <button
                type="button"
                onClick={() => onPickConnector(connector)}
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-600 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {connector.name}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {formatWalletTxError(error)}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg py-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
