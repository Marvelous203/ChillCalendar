'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { validateGoogleMapsUrl } from '@/lib/maps';
import { sheetModal } from '@/lib/motion';

export function AddPlaceSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (payload: { name: string; addr: string; link: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Vui lòng nhập tên quán hoặc địa điểm');
      return;
    }
    if (link.trim() && validateGoogleMapsUrl(link) === null) {
      setError('Chỉ chấp nhận link Google Maps (https://maps.app.goo.gl/... hoặc google.com/maps/...)');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({ name: name.trim(), addr: addr.trim(), link: link.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được địa điểm');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        variants={sheetModal}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Đề xuất địa điểm</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              1. Tên quán / địa điểm *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Katinat Nguyễn Du"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              2. Địa chỉ ngắn (tùy chọn)
            </label>
            <input
              type="text"
              maxLength={160}
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Quận 1, TP.HCM"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              3. Link Google Maps (tùy chọn)
            </label>
            <input
              type="url"
              maxLength={300}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] disabled:opacity-60"
          >
            {submitting ? 'Đang thêm...' : 'Thêm địa điểm'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
