"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`page-transition min-h-full transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
        mounted
          ? "translate-y-0 opacity-100"
          : "translate-y-1 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
