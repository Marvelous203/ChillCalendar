'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { sheetModal } from '@/lib/motion';

export function NameSheet({
  isPrivate,
  submitting,
  onSubmit,
}: {
  isPrivate: boolean;
  submitting: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        variants={sheetModal}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl"
      >
        <h2 className="font-display text-xl font-bold">
          {isPrivate ? 'Xin vào phòng riêng tư' : 'Bạn tên là gì?'}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {isPrivate
            ? 'Nhập tên của bạn để chủ sự kiện nhận ra và duyệt vào phòng.'
            : 'Không cần tài khoản. Tên này sẽ hiển thị trên lịch rảnh của nhóm.'}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit(name.trim());
          }}
          className="mt-4 space-y-3"
        >
          <input
            type="text"
            required
            autoFocus
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vd: Minh Anh, Tuấn..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] disabled:opacity-60"
          >
            {submitting
              ? 'Đang gửi...'
              : isPrivate
                ? 'Gửi yêu cầu vào phòng'
                : 'Vào chọn giờ ngay'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
