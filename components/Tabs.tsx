'use client';

import { motion } from 'motion/react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      className="grid rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 backdrop-blur-xl"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${
              active ? 'text-[var(--primary-fg)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId="room-tab"
                className="absolute inset-0 rounded-xl bg-[var(--primary)] shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-[var(--bg)] text-[var(--muted)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
