'use client';

export function EventListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card animate-pulse space-y-3 p-5"
        >
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 rounded-full bg-white/10" />
            <div className="h-5 w-28 rounded-full bg-white/10" />
          </div>
          <div className="h-5 w-3/4 rounded-lg bg-white/10" />
          <div className="h-3.5 w-1/2 rounded-lg bg-white/10" />
          <div className="border-t border-[var(--border)] pt-3">
            <div className="h-3.5 w-1/3 rounded-lg bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoomSkeleton() {
  return (
    <div className="space-y-5 pb-12">
      <div className="glass-card animate-pulse space-y-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 rounded-full bg-white/10" />
          <div className="h-5 w-20 rounded-full bg-white/10" />
        </div>
        <div className="h-7 w-2/3 rounded-xl bg-white/10" />
        <div className="h-4 w-1/2 rounded-lg bg-white/10" />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
        <div className="h-9 rounded-xl bg-white/10 animate-pulse" />
        <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
      </div>

      <div className="glass-card animate-pulse space-y-2.5 p-4 sm:p-5">
        <div className="h-4 w-48 rounded-lg bg-white/10" />
        <div className="grid grid-cols-4 gap-2 pt-2">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div key={idx} className="h-9 rounded-lg bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="glass-card animate-pulse space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-36 rounded-lg bg-white/10" />
            <div className="h-3 w-48 rounded-lg bg-white/10" />
          </div>
        </div>
        <div className="h-10 w-full rounded-xl bg-white/10" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 rounded-2xl bg-white/10" />
          <div className="h-16 rounded-2xl bg-white/10" />
          <div className="h-16 rounded-2xl bg-white/10" />
        </div>
      </div>
      <EventListSkeleton count={2} />
    </div>
  );
}
