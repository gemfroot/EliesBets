import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Providers } from "@/providers";
import { wagmiConfig } from "@/wagmi";
import { BetslipPanel } from "@/components/Betslip";
import { Header } from "@/components/Header";
import { WrongNetworkBanner } from "@/components/WrongNetworkBanner";
import { MobileLayoutChrome } from "@/components/MobileLayoutChrome";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "EliesBets",
    template: "%s · EliesBets",
  },
  description:
    "Sports betting on Polygon and Gnosis with live and prematch markets, wallet connect, and an in-app betslip.",
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
        alt: "EliesBets — sports betting on Polygon and Gnosis",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const initialState = cookieToInitialState(wagmiConfig, cookie);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-zinc-950 text-zinc-50">
        <Providers initialState={initialState}>
          <div className="flex min-h-screen flex-col pb-14 md:pb-0">
            <WrongNetworkBanner />
            <Header />
            <div className="flex min-h-0 min-w-0 flex-1">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                {children}
              </main>
              <aside
                className="hidden w-64 shrink-0 border-l border-zinc-800 bg-zinc-900/40 p-4 lg:block"
                aria-label="Betslip"
              >
                <BetslipPanel />
              </aside>
            </div>
            <MobileLayoutChrome />
          </div>
        </Providers>
      </body>
    </html>
  );
}
