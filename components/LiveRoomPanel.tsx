'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { compressImageToWebp } from '@/lib/image-compress';
import type { LiveConnectionMode } from '@/lib/use-live-room';
import type { LiveSnapshot } from '@/lib/types';

function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatLocalTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

function formatLocalDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(dt);
}

export function LiveRoomPanel({
  snapshot,
  connectionMode,
  myParticipantId,
  canCheckin,
  canEndLive,
  onCheckin,
  onEndLive,
}: {
  snapshot: LiveSnapshot;
  connectionMode: LiveConnectionMode;
  myParticipantId: string | null;
  canCheckin: boolean;
  canEndLive: boolean;
  onCheckin: (payload: { note?: string; photoUrl?: string }) => Promise<void>;
  onEndLive: () => Promise<void>;
}) {
  const isLive = snapshot.status === 'live';
  const isDone = snapshot.status === 'done';

  const myCheckin = useMemo(
    () => snapshot.checkins.find((c) => c.participantId === myParticipantId) ?? null,
    [snapshot.checkins, myParticipantId]
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [photoDraft, setPhotoDraft] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  const elapsedLabel = useMemo(() => {
    if (!snapshot.liveFrom) return '00:00:00';
    const startMs = Date.parse(snapshot.liveFrom);
    if (Number.isNaN(startMs)) return '00:00:00';
    const endRef = isDone && snapshot.endedAt ? Date.parse(snapshot.endedAt) : nowMs;
    return formatDuration(endRef - startMs);
  }, [snapshot.liveFrom, snapshot.endedAt, isDone, nowMs]);

  const progressPct =
    snapshot.counts.expected > 0
      ? Math.min(100, Math.round((snapshot.counts.checkedIn / snapshot.counts.expected) * 100))
      : snapshot.counts.checkedIn > 0
        ? 100
        : 0;

  async function handleOneTapCheckin() {
    setSubmitting(true);
    try {
      await onCheckin({});
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.7 },
        colors: ['#3DD0C6', '#FF9E78', '#10B981'],
      });
      setNoteDraft('');
      setPhotoDraft('');
      setEditingDetails(true);
    } finally {
      setSubmitting(false);
    }
  }

  function openEditDetails() {
    setNoteDraft(myCheckin?.note ?? '');
    setPhotoDraft(myCheckin?.photoUrl ?? '');
    setUploadError(null);
    setEditingDetails(true);
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingPhoto(true);
    try {
      const webpBlob = await compressImageToWebp(file);
      const fd = new FormData();
      fd.append('file', webpBlob, 'checkin.webp');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Không tải ảnh lên được');
      }
      setPhotoDraft(json.url);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Không xử lý được ảnh. Thử chụp lại hoặc chọn ảnh khác nhé.'
      );
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCheckin({
        note: noteDraft.trim(),
        photoUrl: photoDraft.trim(),
      });
      setEditingDetails(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero Live Card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${
          isLive
            ? 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/15 via-[var(--surface)] to-[var(--primary)]/10 shadow-lg shadow-emerald-500/5'
            : 'border-[var(--border)] bg-[var(--surface)]'
        } backdrop-blur-xl`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isLive ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-extrabold tracking-wide text-emerald-300 ring-1 ring-emerald-400/40">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  ĐANG DIỄN RA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-solid)] px-3 py-1 text-xs font-bold text-[var(--muted)] ring-1 ring-[var(--border)]">
                  ✨ Đã kết thúc
                </span>
              )}

              {isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)]/80 px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      connectionMode === 'ws'
                        ? 'bg-emerald-400'
                        : connectionMode === 'connecting'
                          ? 'animate-pulse bg-amber-400'
                          : 'bg-sky-400'
                    }`}
                  />
                  {connectionMode === 'ws'
                    ? 'Realtime WS'
                    : connectionMode === 'connecting'
                      ? 'Đang nối WS…'
                      : 'Live Sync'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-[var(--text)] sm:text-4xl">
                {snapshot.counts.checkedIn}
                <span className="text-lg font-semibold text-[var(--muted)]">
                  /{snapshot.counts.expected} người đã đến
                </span>
              </p>
              <span className="rounded-lg bg-[var(--surface-solid)]/80 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--primary)]">
                ⏱ {elapsedLabel}
              </span>
            </div>

            {isLive && snapshot.autoEndAt && (
              <p className="text-xs text-[var(--muted)]">
                Tự kết thúc sau 24 giờ lúc{' '}
                <span className="font-semibold text-[var(--text)] tabular-nums">
                  {formatLocalDateTime(snapshot.autoEndAt)}
                </span>
              </p>
            )}
            {isDone && snapshot.endedAt && (
              <p className="text-xs text-[var(--muted)]">
                Kết thúc lúc{' '}
                <span className="font-semibold text-[var(--text)] tabular-nums">
                  {formatLocalDateTime(snapshot.endedAt)}
                </span>{' '}
                ({snapshot.endedBy === 'owner' ? 'chủ phòng kết thúc' : 'tự động sau 24 giờ'}) — dữ liệu kỷ niệm được giữ nguyên.
              </p>
            )}
          </div>

          {canEndLive && (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25"
            >
              ⏹ Kết thúc sự kiện
            </button>
          )}
        </div>

        {/* Thanh tiến độ */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-solid)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>

        {/* Khu vực check-in 1 chạm */}
        {isLive && canCheckin && (
          <div className="mt-5">
            {!myCheckin ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleOneTapCheckin}
                  className="w-full rounded-2xl bg-gradient-to-r from-[var(--primary)] to-emerald-400 px-6 py-4 font-display text-base font-extrabold text-[#06201f] shadow-lg shadow-emerald-500/20 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? 'Đang ghi nhận…' : '📍 Tôi đã đến'}
                </button>
                <p className="text-center text-[11px] text-[var(--muted)]">
                  Bấm 1 chạm để điểm danh ngay. Ảnh và ghi chú (nếu thêm) chỉ chia sẻ trong nhóm kèo này.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/30 bg-[var(--surface-solid)]/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                    <span>✓ Bạn đã check-in lúc {formatLocalTime(myCheckin.checkedInAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      editingDetails ? setEditingDetails(false) : openEditDetails()
                    }
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
                  >
                    {editingDetails ? 'Đóng' : '✏️ Thêm ảnh / ghi chú'}
                  </button>
                </div>

                <AnimatePresence>
                  {editingDetails && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleSaveDetails}
                      className="mt-3 space-y-3 overflow-hidden border-t border-[var(--border)] pt-3"
                    >
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                          <label htmlFor="checkin-note">Ghi chú cảm nghĩ (tùy chọn)</label>
                          <span className="tabular-nums">{noteDraft.length}/200</span>
                        </div>
                        <input
                          id="checkin-note"
                          type="text"
                          maxLength={200}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Ví dụ: Đang ngồi bàn góc cửa sổ, tới nhanh nhé!"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingPhoto}
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)] disabled:opacity-50"
                        >
                          {uploadingPhoto ? 'Đang nén & tải ảnh…' : '📷 Thêm ảnh (xóa GPS)'}
                        </button>
                        {photoDraft && (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoDraft}
                              alt="Ảnh check-in"
                              className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--border)]"
                            />
                            <button
                              type="button"
                              onClick={() => setPhotoDraft('')}
                              className="text-xs text-rose-400 hover:underline"
                            >
                              Gỡ ảnh
                            </button>
                          </div>
                        )}
                      </div>

                      {uploadError && (
                        <p className="text-xs text-rose-400">{uploadError}</p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDetails(false)}
                          className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--muted)]"
                        >
                          Bỏ qua
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || uploadingPhoto}
                          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] disabled:opacity-50"
                        >
                          {submitting ? 'Đang lưu…' : 'Lưu cập nhật'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </motion.section>

      {/* Hai cột danh sách Đã đến & Chưa đến */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card space-y-3 p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">
              Đã đến ({snapshot.checkins.length})
            </h2>
            <span className="text-xs text-[var(--muted)]">Mới nhất ở trên</span>
          </div>

          {snapshot.checkins.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
              Chưa có ai check-in. Hãy là người đầu tiên bấm &ldquo;Tôi đã đến&rdquo; nhé!
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {snapshot.checkins.map((item) => (
                  <motion.div
                    key={item.participantId}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)]/80 p-3.5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <UserAvatar name={item.name} size="sm" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[var(--text)]">
                            {item.name}
                          </span>
                          {item.participantId === myParticipantId && (
                            <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                              Bạn
                            </span>
                          )}
                          <span className="text-xs text-[var(--muted)] tabular-nums">
                            đến lúc {formatLocalTime(item.checkedInAt)}
                          </span>
                        </div>
                        {item.note && (
                          <p className="break-words text-sm text-[var(--text)]/90">
                            “{item.note}”
                          </p>
                        )}
                      </div>
                    </div>

                    {item.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(item.photoUrl)}
                        className="shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--border)] transition hover:scale-105"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photoUrl}
                          alt={`Ảnh check-in của ${item.name}`}
                          className="h-14 w-14 object-cover"
                        />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="glass-card space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">
              Chưa đến ({snapshot.notArrived.length})
            </h2>
            <span className="text-xs text-[var(--muted)]">Đã hẹn đi</span>
          </div>

          {snapshot.notArrived.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--muted)]">
              {snapshot.counts.checkedIn > 0
                ? 'Mọi người đã hẹn đều đã có mặt!'
                : 'Chưa có danh sách người hẹn giờ này.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {snapshot.notArrived.map((person) => (
                <span
                  key={person.participantId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                  {person.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận kết thúc sự kiện */}
      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => !ending && setConfirmEnd(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-sm space-y-4 p-6"
            >
              <h3 className="font-display text-lg font-bold">Kết thúc sự kiện?</h3>
              <p className="text-sm text-[var(--muted)]">
                Hệ thống sẽ khóa check-in mới. Toàn bộ danh sách người đã đến, ghi chú và ảnh vẫn được giữ nguyên.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={ending}
                  onClick={() => setConfirmEnd(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={ending}
                  onClick={async () => {
                    setEnding(true);
                    try {
                      await onEndLive();
                      setConfirmEnd(false);
                    } finally {
                      setEnding(false);
                    }
                  }}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {ending ? 'Đang kết thúc…' : 'Xác nhận kết thúc'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox xem ảnh lớn */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Ảnh check-in phóng to"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
