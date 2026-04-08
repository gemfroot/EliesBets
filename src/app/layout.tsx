import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Providers } from "@/providers";
import { wagmiConfig } from "@/wagmi";
import { BetslipPanel } from "@/components/Betslip";
import { Header } from "@/components/Header";
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

export const metadata: Metadata = {
  title: "EliesBets",
  description: "Sports betting",
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
