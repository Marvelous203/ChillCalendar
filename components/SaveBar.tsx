'use client';

import { AnimatePresence, motion } from 'motion/react';

export function SaveBar({
  dirty,
  saving,
  count,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  count: number;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-md px-4"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--primary)]/30 bg-[var(--surface-solid)] px-4 py-3 shadow-2xl">
            <div className="text-xs">
              <p className="font-bold text-[var(--text)]">Có thay đổi chưa lưu</p>
              <p className="text-[var(--muted)] tabular-nums">Đã chọn {count} ô giờ rảnh</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] shadow-sm disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : 'Lưu giờ rảnh'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
