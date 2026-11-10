export function BoardSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading board">
      <div className="border-b border-line px-5 py-4">
        <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-8 w-full max-w-xl animate-pulse rounded bg-white/5" />
      </div>
      <div className="flex flex-1 gap-3 overflow-hidden px-4 py-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex h-full w-[300px] shrink-0 flex-col rounded-xl bg-white/[0.03] p-2">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-white/10" />
            {Array.from({ length: 3 }, (_, card) => (
              <div key={card} className="mb-2 h-24 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_300px]" aria-busy="true" aria-label="Loading issue">
      <div>
        <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="mt-6 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-8 animate-pulse rounded bg-white/5" />
        ))}
      </div>
    </div>
  );
}
