import Link from "next/link";
import { FavoritesNav } from "@/components/FavoritesNav";
import { LiveCountLink } from "@/components/LiveCountLink";
import { MyBetsLink } from "@/components/MyBetsLink";
import { SportsList } from "@/components/SportsList";

const casinoDisabled = process.env.NEXT_PUBLIC_CASINO_ENABLED === "false";

export function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 py-4 md:flex">
      <div className="flex flex-col gap-1 px-2 pb-3">
        <LiveCountLink />
        <MyBetsLink variant="sidebar" />
        {casinoDisabled ? (
          <div
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-500"
            title="Casino is temporarily disabled"
          >
            <span className="min-w-0 truncate font-medium">Casino</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Soon
            </span>
          </div>
        ) : (
          <Link
            href="/casino"
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <span className="min-w-0 truncate font-medium">Casino</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              New
            </span>
          </Link>
        )}
      </div>
      <FavoritesNav />
      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sports
      </p>
      <SportsList />
    </aside>
  );
}
