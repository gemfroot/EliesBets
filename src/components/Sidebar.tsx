const SPORTS = [
  "Football",
  "Basketball",
  "Tennis",
  "Ice hockey",
  "American football",
];

export function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 py-4 md:flex">
      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sports
      </p>
      <nav className="flex flex-col gap-0.5 px-2" aria-label="Sports">
        {SPORTS.map((name) => (
          <button
            key={name}
            type="button"
            className="rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            {name}
          </button>
        ))}
      </nav>
    </aside>
  );
}
