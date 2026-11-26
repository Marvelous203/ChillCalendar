'use client';

import { useState } from 'react';
import { RoomCodeChip } from './RoomCodeChip';

export function PrivateRoomGate({
  code,
  pending,
  removed,
  submitting,
  onRequestJoin,
}: {
  code: string;
  pending: boolean;
  removed: boolean;
  submitting: boolean;
  onRequestJoin: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="glass-card space-y-4 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-2xl">
          🔒
        </div>
        <div className="flex justify-center">
          <RoomCodeChip code={code} />
        </div>
        <h1 className="font-display text-2xl font-bold">Phòng riêng tư</h1>

        {removed ? (
          <p className="text-sm text-red-500">
            Bạn đã bị mời ra khỏi phòng này nên không thể truy cập.
          </p>
        ) : pending ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Yêu cầu của bạn đã được gửi. Vui lòng chờ chủ sự kiện duyệt — trang sẽ tự mở khi
              được chấp nhận.
            </p>
            <span className="inline-block rounded-full bg-[var(--primary)]/12 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              Đang chờ duyệt...
            </span>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onRequestJoin(name.trim());
            }}
            className="space-y-3 pt-2 text-left"
          >
            <p className="text-center text-xs text-[var(--muted)]">
              Nhập tên để xin phép chủ sự kiện cho vào phòng.
            </p>
            <input
              type="text"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên của bạn..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] disabled:opacity-60"
            >
              {submitting ? 'Đang gửi...' : 'Xin vào phòng'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
