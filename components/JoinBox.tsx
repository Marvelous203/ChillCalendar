'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isValidCode, normalizeCode } from '@/lib/room-code';

export function JoinBox() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(raw);
    if (!isValidCode(code)) {
      setError('Mã phòng gồm 6–8 ký tự (vd: K7M2QX)');
      return;
    }
    setError('');
    router.push(`/e/${code}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-[var(--primary)]">
            #
          </span>
          <input
            type="text"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value.toUpperCase());
              if (error) setError('');
            }}
            placeholder="Nhập mã phòng (vd: PHATDZ)"
            maxLength={10}
            aria-label="Mã phòng"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] py-3.5 pl-9 pr-4 font-mono text-base font-semibold tracking-widest text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-[var(--primary)] px-6 py-3.5 text-sm font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90 active:scale-[0.99]"
        >
          Vào phòng ngay
        </button>
      </div>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </form>
  );
}
