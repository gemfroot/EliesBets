"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ODDS_FORMAT_STORAGE_KEY,
  parseOddsFormat,
  type OddsFormat,
} from "@/lib/oddsFormat";

type OddsFormatContextValue = {
  format: OddsFormat;
  setFormat: (format: OddsFormat) => void;
};

const OddsFormatContext = createContext<OddsFormatContextValue | null>(null);

function writeStorage(format: OddsFormat) {
  try {
    localStorage.setItem(ODDS_FORMAT_STORAGE_KEY, format);
  } catch {
    /* ignore quota */
  }
}

export function OddsFormatProvider({ children }: { children: ReactNode }) {
  const [format, setFormatState] = useState<OddsFormat>("american");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time read
    setFormatState(parseOddsFormat(localStorage.getItem(ODDS_FORMAT_STORAGE_KEY)));
  }, []);

  const setFormat = useCallback((next: OddsFormat) => {
    setFormatState(next);
    writeStorage(next);
  }, []);

  const value = useMemo(
    () => ({ format, setFormat }),
    [format, setFormat],
  );

  return (
    <OddsFormatContext.Provider value={value}>
      {children}
    </OddsFormatContext.Provider>
  );
}

export function useOddsFormat(): OddsFormatContextValue {
  const ctx = useContext(OddsFormatContext);
  if (!ctx) {
    throw new Error("useOddsFormat must be used within OddsFormatProvider");
  }
  return ctx;
}
