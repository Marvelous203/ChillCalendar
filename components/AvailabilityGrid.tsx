'use client';

import { useRef, useState } from 'react';
import { DAY_SESSIONS, formatDateVi, hoursRange, makeSlotKey } from '@/lib/dates';
import { formatHour } from '@/lib/timezone';

export function AvailabilityGrid({
  dates,
  hourFrom,
  hourTo,
  selectedSlots,
  onChange,
  disabled,
}: {
  dates: string[];
  hourFrom: number;
  hourTo: number;
  selectedSlots: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const hours = hoursRange(hourFrom, hourTo);
  const selectedSet = new Set(selectedSlots);

  const dragModeRef = useRef<'add' | 'remove' | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function applySlot(key: string, mode: 'add' | 'remove') {
    const next = new Set(selectedSlots);
    if (mode === 'add') next.add(key);
    else next.delete(key);
    onChange(Array.from(next));
  }

  function handlePointerDown(key: string) {
    if (disabled) return;
    const mode: 'add' | 'remove' = selectedSet.has(key) ? 'remove' : 'add';
    dragModeRef.current = mode;
    lastKeyRef.current = key;
    setDragging(true);
    navigator.vibrate?.(10);
    applySlot(key, mode);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || !dragModeRef.current || disabled) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const slotKey = el?.dataset?.slotKey;
    if (!slotKey || slotKey === lastKeyRef.current) return;
    lastKeyRef.current = slotKey;
    navigator.vibrate?.(10);
    applySlot(slotKey, dragModeRef.current);
  }

  function stopDrag() {
    dragModeRef.current = null;
    lastKeyRef.current = null;
    setDragging(false);
  }

  function toggleSession(date: string, from: number, to: number) {
    if (disabled) return;
    const keys: string[] = [];
    for (let h = Math.max(hourFrom, from); h < Math.min(hourTo, to); h++) {
      keys.push(makeSlotKey(date, h));
    }
    if (keys.length === 0) return;
    const allSelected = keys.every((k) => selectedSet.has(k));
    const next = new Set(selectedSlots);
    for (const k of keys) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    navigator.vibrate?.(10);
    onChange(Array.from(next));
  }

  return (
    <div
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onPointerLeave={stopDrag}
      className="glass-card overflow-hidden p-3 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>Chạm hoặc kéo ngón tay để tô giờ bạn rảnh.</span>
        <span className="tabular-nums font-medium text-[var(--primary)]">
          Đã chọn {selectedSlots.length} giờ
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="inline-grid select-none gap-1.5"
          style={{
            gridTemplateColumns: `64px repeat(${dates.length}, minmax(108px, 1fr))`,
          }}
        >
          {/* Header cột ngày + chip chọn nhanh Sáng/Chiều/Tối */}
          <div className="sticky left-0 z-20 bg-[var(--surface-solid)]" />
          {dates.map((date) => {
            const info = formatDateVi(date);
            return (
              <div key={date} className="space-y-1.5 px-0.5 pb-1 text-center">
                <div>
                  <p className="text-xs font-bold text-[var(--text)]">{info.weekday}</p>
                  <p className="text-[11px] text-[var(--muted)] tabular-nums">{info.short}</p>
                </div>
                <div className="flex justify-center gap-1">
                  {DAY_SESSIONS.map((s) => {
                    const hasHours = Math.max(hourFrom, s.from) < Math.min(hourTo, s.to);
                    if (!hasHours) return null;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSession(date, s.from, s.to)}
                        className="rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Các hàng giờ */}
          {hours.map((h) => (
            <div key={`row-${h}`} className="contents">
              <div className="sticky left-0 z-10 flex items-center justify-end bg-[var(--surface-solid)] pr-2 text-[11px] font-medium text-[var(--muted)] tabular-nums">
                {formatHour(h)}
              </div>
              {dates.map((date) => {
                const key = makeSlotKey(date, h);
                const active = selectedSet.has(key);
                return (
                  <div
                    key={key}
                    data-slot-key={key}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(key);
                    }}
                    onPointerMove={handlePointerMove}
                    style={{ touchAction: 'none' }}
                    className={`h-9 cursor-pointer rounded-lg border transition-colors duration-100 ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/85 shadow-inner'
                        : 'border-[var(--border)] bg-[var(--surface-solid)] hover:border-[var(--primary)]/50'
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
