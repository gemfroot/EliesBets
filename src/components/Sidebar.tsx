import { FavoritesNav } from "@/components/FavoritesNav";
import { LiveCountLink } from "@/components/LiveCountLink";
import { SportsList } from "@/components/SportsList";

export function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 py-4 md:flex">
      <div className="px-2 pb-3">
        <LiveCountLink />
      </div>
      <FavoritesNav />
      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sports
      </p>
      <SportsList />
    </aside>
  );
}
