"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "default" | "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const TOAST_MS = 4500;

function variantClasses(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "border-emerald-800/80 bg-emerald-950/90 text-emerald-100";
    case "error":
      return "border-red-900/80 bg-red-950/90 text-red-100";
    case "info":
      return "border-sky-800/80 bg-sky-950/90 text-sky-100";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-100";
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => removeToast(id), TOAST_MS);
      timers.current.set(id, timer);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 p-0"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/40 ${variantClasses(t.variant)}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
