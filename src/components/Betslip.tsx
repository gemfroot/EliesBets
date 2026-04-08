"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BetslipSelection = {
  id: string;
  gameId: string;
  outcomeName: string;
  odds: string;
};

type BetslipContextValue = {
  selections: BetslipSelection[];
  addSelection: (item: {
    gameId: string;
    outcomeName: string;
    odds: string;
    /** When set, uniquely identifies the outcome (avoids collisions across conditions). */
    outcomeId?: string;
  }) => void;
  removeSelection: (id: string) => void;
};

const BetslipContext = createContext<BetslipContextValue | null>(null);

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) {
    throw new Error("useBetslip must be used within BetslipProvider");
  }
  return ctx;
}

function selectionId(
  gameId: string,
  outcomeName: string,
  outcomeId?: string,
): string {
  if (outcomeId) {
    return `${gameId}::${outcomeId}`;
  }
  return `${gameId}::${outcomeName}`;
}

export function BetslipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetslipSelection[]>([]);

  const addSelection = useCallback(
    (item: {
      gameId: string;
      outcomeName: string;
      odds: string;
      outcomeId?: string;
    }) => {
      const id = selectionId(item.gameId, item.outcomeName, item.outcomeId);
      setSelections((prev) => {
        const next = prev.filter((s) => s.id !== id);
        next.push({
          id,
          gameId: item.gameId,
          outcomeName: item.outcomeName,
          odds: item.odds,
        });
        return next;
      });
    },
    [],
  );

  const removeSelection = useCallback((id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({ selections, addSelection, removeSelection }),
    [selections, addSelection, removeSelection],
  );

  return (
    <BetslipContext.Provider value={value}>{children}</BetslipContext.Provider>
  );
}

export function BetslipPanel() {
  const { selections, removeSelection } = useBetslip();

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Betslip
      </p>
      {selections.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No selections yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {selections.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100">{s.outcomeName}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-300">
                  {s.odds}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeSelection(s.id)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label={`Remove ${s.outcomeName}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
