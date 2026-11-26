'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { sheetModal } from '@/lib/motion';
import type { FinalizePolicy, PublicParticipant, Visibility } from '@/lib/types';
import { useToast } from './Toast';
import { UserAvatar } from './UserAvatar';

export function ManageSheet({
  code,
  title,
  note,
  visibility,
  finalizePolicy,
  inviteToken,
  participants,
  onClose,
  onUpdateSettings,
  onRotateCode,
  onUpdateMember,
  onDeleteRoom,
}: {
  code: string;
  title: string;
  note: string;
  visibility: Visibility;
  finalizePolicy: FinalizePolicy;
  inviteToken?: string;
  participants: PublicParticipant[];
  onClose: () => void;
  onUpdateSettings: (patch: {
    title: string;
    note: string;
    visibility: Visibility;
    finalizePolicy: FinalizePolicy;
  }) => Promise<void>;
  onRotateCode: () => Promise<void>;
  onUpdateMember: (id: string, status: 'approved' | 'removed') => Promise<void>;
  onDeleteRoom: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editTitle, setEditTitle] = useState(title);
  const [editNote, setEditNote] = useState(note);
  const [editVis, setEditVis] = useState<Visibility>(visibility);
  const [editPol, setEditPol] = useState<FinalizePolicy>(finalizePolicy);
  const [saving, setSaving] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = inviteToken
    ? `${origin}/e/${code}?i=${inviteToken}`
    : `${origin}/e/${code}`;

  const pendingMembers = participants.filter((p) => p.status === 'pending');
  const approvedMembers = participants.filter((p) => p.status === 'approved');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateSettings({
        title: editTitle,
        note: editNote,
        visibility: editVis,
        finalizePolicy: editPol,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        variants={sheetModal}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Quản lý phòng</h3>
          <button type="button" onClick={onClose} className="px-2 py-1 text-sm text-[var(--muted)]">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Tên sự kiện
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Ghi chú
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                Kiểu truy cập
              </label>
              <select
                value={editVis}
                onChange={(e) => setEditVis(e.target.value as Visibility)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                <option value="link">Ai có mã/link</option>
                <option value="private">Riêng tư</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                Quyền chốt lịch
              </label>
              <select
                value={editPol}
                onChange={(e) => setEditPol(e.target.value as FinalizePolicy)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                <option value="any_member">Mọi thành viên</option>
                <option value="owner_only">Chỉ chủ sự kiện</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-bold text-[var(--primary-fg)]"
          >
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </form>

        <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--muted)]">Link mời trực tiếp</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast('Đã sao chép link mời', 'success');
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold"
            >
              Sao chép link
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">
              Nếu lộ mã phòng, bạn có thể đổi mã mới:
            </span>
            <button
              type="button"
              onClick={onRotateCode}
              className="rounded-lg border border-[var(--accent)]/40 px-3 py-1 text-xs font-semibold text-[var(--accent)]"
            >
              Đổi mã phòng
            </button>
          </div>
        </div>

        {(pendingMembers.length > 0 || approvedMembers.length > 0) && (
          <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
            {pendingMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--accent)]">
                  Đang chờ duyệt ({pendingMembers.length})
                </p>
                {pendingMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <UserAvatar name={m.name} size="sm" />
                      <span className="text-xs font-semibold">{m.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateMember(m.id, 'approved')}
                        className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[11px] font-bold text-[var(--primary-fg)]"
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateMember(m.id, 'removed')}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-red-500"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {approvedMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--muted)]">
                  Thành viên ({approvedMembers.length})
                </p>
                {approvedMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <UserAvatar name={m.name} size="sm" />
                      <span className="text-xs font-medium">{m.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateMember(m.id, 'removed')}
                      className="text-[11px] text-[var(--muted)] hover:text-red-500"
                    >
                      Gỡ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-[var(--border)] pt-4 text-right">
          <button
            type="button"
            onClick={onDeleteRoom}
            className="text-xs font-semibold text-red-500 hover:underline"
          >
            Xóa sự kiện này vĩnh viễn
          </button>
        </div>
      </motion.div>
    </div>
  );
}
