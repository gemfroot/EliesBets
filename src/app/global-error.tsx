"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <title>Error · EliesBets</title>
      </head>
      <body className="min-h-full overflow-x-hidden bg-zinc-950 text-zinc-50">
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <div
            role="alert"
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl"
          >
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The app hit an unexpected error. You can try again — if the problem
              continues, refresh the page or come back later.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-zinc-500">
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                try {
                  unstable_retry();
                } catch {
                  window.location.reload();
                }
              }}
              className="mt-6 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white sm:w-auto"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
