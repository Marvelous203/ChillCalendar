'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { compressImageToWebp } from '@/lib/image-compress';
import type { LiveConnectionMode } from '@/lib/use-live-room';
import type { LiveSnapshot, PublicCheckin } from '@/lib/types';

const MAX_MOMENTS = 5;

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
  isOwner,
  canCheckin,
  canEndLive,
  onCheckin,
  onAddMoment,
  onDeleteMoment,
  onEndLive,
}: {
  snapshot: LiveSnapshot;
  connectionMode: LiveConnectionMode;
  myParticipantId: string | null;
  isOwner: boolean;
  canCheckin: boolean;
  canEndLive: boolean;
  onCheckin: (payload: { note?: string; photoUrl?: string }) => Promise<void>;
  onAddMoment: (payload: { photoUrl: string; caption: string }) => Promise<void>;
  onDeleteMoment: (momentId: string) => Promise<void>;
  onEndLive: () => Promise<void>;
}) {
  const isLive = snapshot.status === 'live';
  const isDone = snapshot.status === 'done';

  const myCheckin = useMemo(
    () => snapshot.checkins.find((c) => c.participantId === myParticipantId) ?? null,
    [snapshot.checkins, myParticipantId]
  );

  const myMomentsCount = myCheckin?.moments.length ?? 0;
  const canAddMoreMoments = isLive && canCheckin && myMomentsCount < MAX_MOMENTS;

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  // Ghi chú ngay lúc check-in
  const [checkinNote, setCheckinNote] = useState('');

  // Modal sửa ghi chú check-in
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  // Composer chụp / đăng khoảnh khắc (ảnh + chữ cùng lúc)
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPreviewUrl, setComposerPreviewUrl] = useState<string | null>(null);
  const [composerBlob, setComposerBlob] = useState<Blob | null>(null);
  const [composerCaption, setComposerCaption] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [uploadingMoment, setUploadingMoment] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Modal kết thúc sự kiện
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  // Gallery Lightbox theo từng người
  const [lightboxPersonId, setLightboxPersonId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const lightboxPerson: PublicCheckin | null = useMemo(
    () => snapshot.checkins.find((c) => c.participantId === lightboxPersonId) ?? null,
    [snapshot.checkins, lightboxPersonId]
  );

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  useEffect(() => {
    return () => {
      if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
    };
  }, [composerPreviewUrl]);

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

  async function handleOneTapCheckin(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitting(true);
    try {
      await onCheckin({ note: checkinNote.trim() });
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.7 },
        colors: ['#3DD0C6', '#FF9E78', '#10B981'],
      });
      setCheckinNote('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCheckin({ note: noteDraft.trim() });
      setEditingNote(false);
    } finally {
      setSubmitting(false);
    }
  }

  function openComposer() {
    setComposerError(null);
    setComposerCaption('');
    if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
    setComposerPreviewUrl(null);
    setComposerBlob(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    if (uploadingMoment) return;
    setComposerOpen(false);
    if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
    setComposerPreviewUrl(null);
    setComposerBlob(null);
    setComposerCaption('');
    setComposerError(null);
  }

  async function handlePickMomentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError(null);
    try {
      const webpBlob = await compressImageToWebp(file);
      if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
      const preview = URL.createObjectURL(webpBlob);
      setComposerBlob(webpBlob);
      setComposerPreviewUrl(preview);
      setComposerOpen(true);
    } catch (err) {
      setComposerError(
        err instanceof Error
          ? err.message
          : 'Không xử lý được ảnh. Thử chụp lại hoặc chọn ảnh khác nhé.'
      );
    } finally {
      e.target.value = '';
    }
  }

  async function handleSubmitMoment(e: React.FormEvent) {
    e.preventDefault();
    if (!composerBlob) {
      setComposerError('Vui lòng chọn hoặc chụp ảnh trước khi đăng');
      return;
    }
    setUploadingMoment(true);
    setComposerError(null);
    try {
      const fd = new FormData();
      fd.append('file', composerBlob, 'moment.webp');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const uploadJson = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.url) {
        throw new Error(uploadJson.error ?? 'Không tải ảnh lên được');
      }

      const hadCheckin = Boolean(myCheckin);
      await onAddMoment({
        photoUrl: uploadJson.url,
        caption: composerCaption.trim(),
      });

      if (!hadCheckin) {
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.7 },
          colors: ['#3DD0C6', '#FF9E78', '#10B981'],
        });
      }
      setComposerOpen(false);
      if (composerPreviewUrl) URL.revokeObjectURL(composerPreviewUrl);
      setComposerPreviewUrl(null);
      setComposerBlob(null);
      setComposerCaption('');
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : 'Không đăng được khoảnh khắc, thử lại nhé'
      );
    } finally {
      setUploadingMoment(false);
    }
  }

  function openLightbox(person: PublicCheckin, index = 0) {
    if (person.moments.length === 0) return;
    setLightboxPersonId(person.participantId);
    setLightboxIndex(Math.max(0, Math.min(index, person.moments.length - 1)));
  }

  const activeMoment =
    lightboxPerson && lightboxPerson.moments.length > 0
      ? lightboxPerson.moments[Math.min(lightboxIndex, lightboxPerson.moments.length - 1)]
      : null;

  return (
    <div className="space-y-4">
      {/* Input file ẩn cho Chọn ảnh & Chụp camera */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePickMomentFile}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePickMomentFile}
        className="hidden"
      />

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

        {/* Khu vực Check-in kèm chữ ngay lập tức / Chụp khoảnh khắc tiếp */}
        {isLive && canCheckin && (
          <div className="mt-5">
            {!myCheckin ? (
              <form onSubmit={handleOneTapCheckin} className="space-y-2.5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    maxLength={200}
                    value={checkinNote}
                    onChange={(e) => setCheckinNote(e.target.value)}
                    placeholder="Ghi vài chữ lúc check-in (tùy chọn)..."
                    className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="shrink-0 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-emerald-400 px-6 py-3 font-display text-sm font-extrabold text-[#06201f] shadow-lg shadow-emerald-500/20 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 sm:text-base"
                  >
                    {submitting ? 'Đang ghi nhận…' : '📍 Tôi đã đến'}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Có thể check-in ngay kèm lời nhắn, hoặc bấm nút chụp ảnh bên dưới để check-in kèm khoảnh khắc.
                </p>
              </form>
            ) : (
              <div className="rounded-2xl border border-emerald-400/30 bg-[var(--surface-solid)]/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-emerald-300">
                      ✓ Bạn đã check-in lúc {formatLocalTime(myCheckin.checkedInAt)}
                    </p>
                    {myCheckin.note && (
                      <p className="text-xs text-[var(--text)]/90">“{myCheckin.note}”</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteDraft(myCheckin.note ?? '');
                        setEditingNote((v) => !v);
                      }}
                      className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
                    >
                      {editingNote ? 'Đóng' : '✏️ Sửa chữ'}
                    </button>
                    {canAddMoreMoments && (
                      <button
                        type="button"
                        onClick={openComposer}
                        className="rounded-xl bg-[var(--primary)] px-3.5 py-1.5 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90"
                      >
                        📸 Chụp / Đăng khoảnh khắc ({myMomentsCount}/{MAX_MOMENTS})
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {editingNote && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleSaveNote}
                      className="mt-3 space-y-2.5 overflow-hidden border-t border-[var(--border)] pt-3"
                    >
                      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                        <label htmlFor="checkin-note">Lời nhắn check-in</label>
                        <span className="tabular-nums">{noteDraft.length}/200</span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id="checkin-note"
                          type="text"
                          maxLength={200}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Ví dụ: Đang ngồi bàn góc cửa sổ, tới nhanh nhé!"
                          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] disabled:opacity-50"
                        >
                          {submitting ? 'Đang lưu…' : 'Lưu chữ'}
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

      {/* Lưới mỗi người 1 Grid Card (Web & Mobile) */}
      <div className="glass-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">
              Khoảnh khắc có mặt ({snapshot.checkins.length})
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {isLive && canCheckin
                ? 'Nhấn vào ô của bạn hoặc bấm Chụp khoảnh khắc để chia sẻ ảnh kèm chữ'
                : 'Mỗi thành viên là một ô kỷ niệm · Bấm vào ảnh để xem tất cả khoảnh khắc'}
            </p>
          </div>

          {canAddMoreMoments && (
            <button
              type="button"
              onClick={openComposer}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <span>📸</span>
              <span>Đăng khoảnh khắc ({myMomentsCount}/{MAX_MOMENTS})</span>
            </button>
          )}
        </div>

        {snapshot.checkins.length === 0 && !(isLive && canCheckin) ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            Chưa có ai check-in.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {/* Ô Grid mời check-in / chụp ảnh nếu bạn chưa check-in */}
            {isLive && canCheckin && !myCheckin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative flex aspect-[4/5] flex-col items-center justify-between rounded-2xl border-2 border-dashed border-[var(--primary)]/50 bg-gradient-to-b from-[var(--primary)]/10 to-[var(--surface-solid)] p-3.5 text-center transition hover:border-[var(--primary)]"
              >
                <span className="self-start rounded-full bg-[var(--primary)]/20 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                  Ô của bạn
                </span>

                <button
                  type="button"
                  onClick={openComposer}
                  className="flex flex-1 flex-col items-center justify-center gap-2 px-1"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/20 text-2xl transition group-hover:scale-110">
                    📸
                  </span>
                  <span className="text-xs font-bold text-[var(--text)]">
                    Chụp / Đăng khoảnh khắc
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Ảnh + chữ cùng lúc
                  </span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleOneTapCheckin()}
                  className="w-full rounded-xl bg-[var(--surface)] py-2 text-[11px] font-bold text-[var(--primary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--primary)] hover:text-[var(--primary-fg)]"
                >
                  {submitting ? 'Đang ghi…' : '📍 Điểm danh ngay'}
                </button>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {snapshot.checkins.map((item) => {
                const isMe = item.participantId === myParticipantId;
                const latestPhoto = item.moments[0]?.photoUrl || item.photoUrl;
                const latestText = item.moments[0]?.caption || item.note;
                const momentCount = item.moments.length;
                const canTapToUpload = isMe && canAddMoreMoments && !latestPhoto;

                return (
                  <motion.div
                    key={item.participantId}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl border bg-[var(--surface-solid)] transition hover:-translate-y-0.5 ${
                      isMe
                        ? 'border-[var(--primary)]/60 ring-2 ring-[var(--primary)]/25'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    {/* Nền ảnh hoặc nền avatar */}
                    {latestPhoto ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(item, 0)}
                        className="absolute inset-0 h-full w-full text-left"
                        aria-label={`Xem khoảnh khắc của ${item.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={latestPhoto}
                          alt={`Khoảnh khắc của ${item.name}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
                      </button>
                    ) : (
                      <div
                        onClick={() => {
                          if (canTapToUpload) openComposer();
                        }}
                        role={canTapToUpload ? 'button' : undefined}
                        tabIndex={canTapToUpload ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (canTapToUpload && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            openComposer();
                          }
                        }}
                        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center ${
                          canTapToUpload
                            ? 'cursor-pointer bg-gradient-to-b from-[var(--primary)]/12 via-[var(--surface-solid)] to-[var(--surface-solid)] hover:from-[var(--primary)]/20'
                            : 'bg-gradient-to-b from-[var(--surface)] to-[var(--surface-solid)]'
                        }`}
                      >
                        <UserAvatar name={item.name} size="md" />
                        {canTapToUpload ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--primary)]/60 bg-[var(--primary)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">
                            📸 Chụp khoảnh khắc
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[var(--muted)]">
                            ✓ Đã có mặt
                          </span>
                        )}
                      </div>
                    )}

                    {/* Header trên card */}
                    <div className="relative z-10 flex items-center justify-between gap-1.5 p-2.5">
                      <div className="flex items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
                            isMe
                              ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                              : 'bg-black/45 text-white/90'
                          }`}
                        >
                          {isMe ? 'Bạn' : formatLocalTime(item.checkedInAt)}
                        </span>
                        {momentCount > 1 && (
                          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md tabular-nums">
                            📸 {momentCount}
                          </span>
                        )}
                      </div>

                      {isMe && canAddMoreMoments && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openComposer();
                          }}
                          className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md transition hover:bg-black/85"
                        >
                          {momentCount > 0 ? '+ Ảnh' : '📸 Ảnh'}
                        </button>
                      )}
                    </div>

                    {/* Footer thông tin người & ghi chú */}
                    <div
                      className={`relative z-10 space-y-1 p-3 ${
                        latestPhoto ? 'text-white' : 'text-[var(--text)]'
                      } pointer-events-none`}
                    >
                      <div className="flex items-center gap-2">
                        {latestPhoto && <UserAvatar name={item.name} size="sm" />}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold sm:text-sm">
                            {item.name}
                          </p>
                          {latestPhoto && (
                            <p className="text-[10px] text-white/75 tabular-nums">
                              {formatLocalTime(item.moments[0]?.createdAt ?? item.checkedInAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      {latestText && (
                        <p
                          className={`line-clamp-2 break-words text-[11px] leading-snug ${
                            latestPhoto ? 'text-white/90' : 'text-[var(--muted)]'
                          }`}
                        >
                          “{latestText}”
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Danh sách Chưa đến gọn bên dưới */}
      <div className="glass-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold sm:text-base">
            Chưa đến ({snapshot.notArrived.length})
          </h2>
          <span className="text-xs text-[var(--muted)]">Đã hẹn đi</span>
        </div>

        {snapshot.notArrived.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted)]">
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

      {/* Modal Chụp / Đăng khoảnh khắc (ảnh + chữ cùng lúc) */}
      <AnimatePresence>
        {composerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={closeComposer}
          >
            <motion.form
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmitMoment}
              className="glass-card w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-3xl sm:p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">Đăng khoảnh khắc</h3>
                  <p className="text-xs text-[var(--muted)]">
                    Đã đăng {myMomentsCount}/{MAX_MOMENTS} ảnh · Tự xóa GPS khỏi ảnh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeComposer}
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
                >
                  ✕
                </button>
              </div>

              {composerPreviewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={composerPreviewUrl}
                    alt="Xem trước khoảnh khắc"
                    className="max-h-72 w-full object-contain"
                  />
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                    >
                      📸 Chụp lại
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                    >
                      🖼 Chọn khác
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--primary)]/50 bg-[var(--primary)]/10 p-6 text-center transition hover:border-[var(--primary)]"
                  >
                    <span className="text-3xl">📸</span>
                    <span className="text-xs font-bold text-[var(--text)]">Chụp ảnh ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-solid)] p-6 text-center transition hover:border-[var(--primary)]"
                  >
                    <span className="text-3xl">🖼</span>
                    <span className="text-xs font-bold text-[var(--text)]">Chọn từ máy</span>
                  </button>
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                  <label htmlFor="moment-caption">Viết chữ cho khoảnh khắc này</label>
                  <span className="tabular-nums">{composerCaption.length}/200</span>
                </div>
                <textarea
                  id="moment-caption"
                  rows={2}
                  maxLength={200}
                  value={composerCaption}
                  onChange={(e) => setComposerCaption(e.target.value)}
                  placeholder="Kể lại khoảnh khắc lúc này..."
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              {composerError && (
                <p className="text-xs text-rose-400">{composerError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={uploadingMoment}
                  onClick={closeComposer}
                  className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!composerBlob || uploadingMoment}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-fg)] shadow-sm disabled:opacity-50"
                >
                  {uploadingMoment ? 'Đang đăng…' : 'Đăng khoảnh khắc'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

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
                Hệ thống sẽ khóa check-in và đăng ảnh mới. Toàn bộ danh sách người đã đến, ghi chú và ảnh khoảnh khắc vẫn được giữ nguyên.
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

      {/* Lightbox Carousel xem toàn bộ khoảnh khắc của 1 người */}
      <AnimatePresence>
        {lightboxPerson && activeMoment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setLightboxPersonId(null)}
          >
            <div
              className="flex w-full max-w-2xl flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={lightboxPerson.name} size="sm" />
                  <div>
                    <p className="text-sm font-bold">{lightboxPerson.name}</p>
                    <p className="text-[11px] text-white/70 tabular-nums">
                      {formatLocalTime(activeMoment.createdAt)} · Ảnh {lightboxIndex + 1}/{lightboxPerson.moments.length}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(isOwner || lightboxPerson.participantId === myParticipantId) &&
                    !activeMoment.id.startsWith('checkin-') && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteMoment(activeMoment.id);
                          if (lightboxPerson.moments.length <= 1) {
                            setLightboxPersonId(null);
                          } else {
                            setLightboxIndex((i) => Math.max(0, i - 1));
                          }
                        }}
                        className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/35"
                      >
                        🗑 Xóa
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setLightboxPersonId(null)}
                    className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeMoment.photoUrl}
                  alt={`Khoảnh khắc của ${lightboxPerson.name}`}
                  className="max-h-[68vh] w-full object-contain"
                />

                {lightboxPerson.moments.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((i) =>
                          i === 0 ? lightboxPerson.moments.length - 1 : i - 1
                        )
                      }
                      className="absolute left-2 rounded-full bg-black/60 px-3 py-2 text-sm font-bold text-white backdrop-blur-md hover:bg-black/80"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((i) =>
                          (i + 1) % lightboxPerson.moments.length
                        )
                      }
                      className="absolute right-2 rounded-full bg-black/60 px-3 py-2 text-sm font-bold text-white backdrop-blur-md hover:bg-black/80"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {activeMoment.caption && (
                <p className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm text-white">
                  “{activeMoment.caption}”
                </p>
              )}

              {lightboxPerson.moments.length > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto py-1">
                  {lightboxPerson.moments.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        idx === lightboxIndex
                          ? 'border-[var(--primary)] scale-105'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
