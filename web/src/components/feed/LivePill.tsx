export function LivePill({ count }: { count: number }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {count} open {count === 1 ? "game" : "games"}
    </p>
  );
}
