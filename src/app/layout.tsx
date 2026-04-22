import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/providers";
import { BetslipPanel } from "@/components/Betslip";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BetslipAsideGate } from "@/components/LayoutChrome";
import { MobileLayoutChrome } from "@/components/MobileLayoutChrome";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";
import { getSiteUrl } from "@/lib/siteUrl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "EliesBets",
    template: "%s · EliesBets",
  },
  description:
    "Sports betting on Polygon, Gnosis, and Base with live and prematch markets, wallet connect, and an in-app betslip.",
  applicationName: "EliesBets",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en",
    siteName: "EliesBets",
    title: "EliesBets",
    description:
      "Sports betting with live and prematch markets. Connect your wallet and place bets on-chain.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EliesBets — sports betting on Polygon, Gnosis, and Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EliesBets",
    description:
      "Sports betting with live and prematch markets. Connect your wallet and place bets on-chain.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Root layout is deliberately static — no `cookies()` / `headers()` calls.
 * A single dynamic API anywhere in the layout tree forces every route to
 * render per-request, which is what tanked perf after the chain cookie
 * landed (1f4363a, 2026-04-15). Chain-specific SSR now happens inside
 * `/[chain]/layout.tsx`, and the wallet session rehydrates client-side
 * (brief disconnected flash on first paint — acceptable trade for instant
 * ISR-cached list pages).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-zinc-950 text-zinc-50">
        <Providers>
          <div className="flex min-h-screen flex-col pb-14 md:pb-0">
            <Header />
            <div className="flex min-h-0 min-w-0 flex-1">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                {children}
              </main>
              <BetslipAsideGate>
                <aside
                  className="hidden w-64 shrink-0 border-l border-zinc-800 bg-zinc-900/40 p-4 lg:block"
                  aria-label="Betslip"
                >
                  <BetslipPanel />
                </aside>
              </BetslipAsideGate>
            </div>
            <Footer />
            <MobileLayoutChrome />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
