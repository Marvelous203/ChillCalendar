'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { compressImageToWebp } from '@/lib/image-compress';
import { getParticipantToken } from '@/lib/participant-token';
import type { LiveConnectionMode } from '@/lib/use-live-room';
import type {
  LiveSnapshot,
  PublicMoment,
  PublicParticipant,
  TimelineEntry,
  TimelinePage,
} from '@/lib/types';

const MAX_MOMENTS = 5;
const MERGE_WINDOW_MS = 5 * 60 * 1000;
const INITIAL_VISIBLE_LIMIT = 20;

const CUTE_THEMES = [
  {
    bg: 'bg-emerald-500/15 border-emerald-400/30',
    text: 'text-emerald-300',
    emoji: '🥦',
  },
  {
    bg: 'bg-rose-500/15 border-rose-400/30',
    text: 'text-rose-300',
    emoji: '🍅',
  },
  {
    bg: 'bg-amber-500/15 border-amber-400/30',
    text: 'text-amber-300',
    emoji: '🎃',
  },
  {
    bg: 'bg-purple-500/15 border-purple-400/30',
    text: 'text-purple-300',
    emoji: '🍆',
  },
  {
    bg: 'bg-sky-500/15 border-sky-400/30',
    text: 'text-sky-300',
    emoji: '🥑',
  },
  {
    bg: 'bg-pink-500/15 border-pink-400/30',
    text: 'text-pink-300',
    emoji: '🍓',
  },
];

type DisplayView = 'timeline' | 'hourly';

type TimelineBlock =
  | {
      id: string;
      kind: 'checkin';
      timestamp: string;
      participantId: string;
      name: string;
      note: string;
    }
  | {
      id: string;
      kind: 'moment_group';
      timestamp: string;
      participantId: string;
      name: string;
      moments: Array<{
        id: string;
        photoUrl: string;
        caption: string;
        createdAt: string;
      }>;
    };

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

function formatHourBucket(iso: string): { key: string; label: string } {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { key: '00', label: '00:00' };
  const hh = String(dt.getHours()).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return {
    key: `${dt.getFullYear()}-${mm}-${dd}-${hh}`,
    label: `${hh}:00 · ${dd}/${mm}`,
  };
}

function snapshotToTimelineEntries(
  snapshot: LiveSnapshot,
  filterParticipantId: string | null,
  order: 'asc' | 'desc'
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const c of snapshot.checkins) {
    if (filterParticipantId && c.participantId !== filterParticipantId) continue;
    entries.push({
      id: `checkin:${c.participantId}`,
      kind: 'checkin',
      timestamp: c.checkedInAt,
      participantId: c.participantId,
      name: c.name,
      note: c.note,
    });
    for (const m of c.moments) {
      entries.push({
        id: `moment:${m.id}`,
        kind: 'moment',
        timestamp: m.createdAt,
        participantId: c.participantId,
        name: c.name,
        photoUrl: m.photoUrl,
        caption: m.caption,
      });
    }
  }
  entries.sort((a, b) =>
    order === 'desc'
      ? b.timestamp.localeCompare(a.timestamp)
      : a.timestamp.localeCompare(b.timestamp)
  );
  return entries;
}

/** Gộp các ảnh liên tiếp của cùng 1 người trong vòng 5 phút thành 1 block 2x2/carousel. */
function groupTimelineBlocks(entries: TimelineEntry[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  for (const entry of entries) {
    if (entry.kind === 'checkin') {
      blocks.push(entry);
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (
      prev &&
      prev.kind === 'moment_group' &&
      prev.participantId === entry.participantId &&
      Math.abs(Date.parse(prev.moments[prev.moments.length - 1].createdAt) - Date.parse(entry.timestamp)) <=
        MERGE_WINDOW_MS
    ) {
      prev.moments.push({
        id: entry.id.replace(/^moment:/, ''),
        photoUrl: entry.photoUrl,
        caption: entry.caption,
        createdAt: entry.timestamp,
      });
      continue;
    }

    blocks.push({
      id: `group:${entry.id}`,
      kind: 'moment_group',
      timestamp: entry.timestamp,
      participantId: entry.participantId,
      name: entry.name,
      moments: [
        {
          id: entry.id.replace(/^moment:/, ''),
          photoUrl: entry.photoUrl,
          caption: entry.caption,
          createdAt: entry.timestamp,
        },
      ],
    });
  }

  return blocks;
}

function countEntries(snap: LiveSnapshot): number {
  return snap.checkins.reduce((sum, c) => sum + 1 + c.moments.length, 0);
}

export function LiveRoomPanel({
  snapshot,
  participants = [],
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
  participants?: PublicParticipant[];
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

  // Giữ vị trí cuộn khi có mục mới từ WS lúc người dùng đang đọc mục cũ bên dưới
  const [scrolledDown, setScrolledDown] = useState(false);
  const [heldSnapshot, setHeldSnapshot] = useState<{
    baseCount: number;
    snapshot: LiveSnapshot;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    function onScroll() {
      const down = window.scrollY > 260;
      setScrolledDown((prev) => {
        if (!prev && down) {
          setHeldSnapshot({
            baseCount: countEntries(snapshotRef.current),
            snapshot: snapshotRef.current,
          });
        } else if (prev && !down) {
          setHeldSnapshot(null);
        }
        return down;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Nếu đang cuộn xuống và chưa có heldSnapshot, snapshot mới sẽ được giữ riêng khi người dùng thao tác cuộn
  const activeSnapshot = useMemo(() => {
    if (!scrolledDown || !heldSnapshot) return snapshot;
    return heldSnapshot.snapshot;
  }, [scrolledDown, heldSnapshot, snapshot]);

  const pendingNewCount = useMemo(() => {
    if (!scrolledDown || !heldSnapshot) return 0;
    return Math.max(0, countEntries(snapshot) - heldSnapshot.baseCount);
  }, [scrolledDown, heldSnapshot, snapshot]);

  const myCheckin = useMemo(
    () => snapshot.checkins.find((c) => c.participantId === myParticipantId) ?? null,
    [snapshot.checkins, myParticipantId]
  );

  const myMomentsCount = myCheckin?.moments.length ?? 0;
  const canAddMoreMoments = isLive && canCheckin && myMomentsCount < MAX_MOMENTS;

  // Danh sách thành viên hiển thị trong Grid Table (giữ nguyên bảng, thay icon bằng ảnh khi đã đăng)
  const roomGridPeople = useMemo(() => {
    const checkinById = new Map(activeSnapshot.checkins.map((c) => [c.participantId, c]));

    const peopleMap = new Map<
      string,
      {
        id: string;
        name: string;
        checkedIn: boolean;
        photoUrl: string;
        moments: PublicMoment[];
      }
    >();

    for (const p of participants) {
      if (p.status !== 'approved') continue;
      const c = checkinById.get(p.id);
      peopleMap.set(p.id, {
        id: p.id,
        name: p.name,
        checkedIn: Boolean(c),
        photoUrl: c?.moments[0]?.photoUrl || c?.photoUrl || '',
        moments: c?.moments ?? [],
      });
    }
    for (const n of activeSnapshot.notArrived) {
      if (!peopleMap.has(n.participantId)) {
        peopleMap.set(n.participantId, {
          id: n.participantId,
          name: n.name,
          checkedIn: false,
          photoUrl: '',
          moments: [],
        });
      }
    }
    for (const c of activeSnapshot.checkins) {
      if (!peopleMap.has(c.participantId)) {
        peopleMap.set(c.participantId, {
          id: c.participantId,
          name: c.name,
          checkedIn: true,
          photoUrl: c.moments[0]?.photoUrl || c.photoUrl || '',
          moments: c.moments,
        });
      }
    }

    const list = Array.from(peopleMap.values());
    list.sort((a, b) => {
      if (a.id === myParticipantId) return -1;
      if (b.id === myParticipantId) return 1;
      // Người đã đăng ảnh hoặc đã check-in ưu tiên hiển thị trước người đang đợi
      const aHasPhoto = a.moments.length > 0 || Boolean(a.photoUrl);
      const bHasPhoto = b.moments.length > 0 || Boolean(b.photoUrl);
      if (aHasPhoto !== bHasPhoto) return aHasPhoto ? -1 : 1;
      return 0;
    });
    return list;
  }, [participants, activeSnapshot, myParticipantId]);

  // Chế độ mặc định: Live -> Timeline dọc (mới nhất trên đầu); Done -> Khung giờ (cũ nhất trên đầu)
  const [viewOverride, setViewOverride] = useState<DisplayView | null>(null);
  const activeView: DisplayView = viewOverride ?? (isDone ? 'hourly' : 'timeline');

  // Lọc theo người qua dải avatar
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Phân trang cursor qua API /timeline khi dữ liệu dài
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_LIMIT);
  const [extraEntries, setExtraEntries] = useState<TimelineEntry[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  // Ghi chú ngay lúc check-in
  const [checkinNote, setCheckinNote] = useState('');
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

  // Lightbox xem ảnh lớn & lướt qua các khoảnh khắc
  const [lightboxItems, setLightboxItems] = useState<Array<PublicMoment & { authorName: string }>>(
    []
  );
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  const order: 'asc' | 'desc' = activeView === 'hourly' ? 'asc' : 'desc';

  const allEntries = useMemo(() => {
    if (extraEntries) return extraEntries;
    return snapshotToTimelineEntries(activeSnapshot, selectedPersonId, order);
  }, [extraEntries, activeSnapshot, selectedPersonId, order]);

  const visibleEntries = useMemo(
    () => allEntries.slice(0, visibleLimit),
    [allEntries, visibleLimit]
  );

  const canShowMoreLocal = allEntries.length > visibleLimit;

  const timelineBlocks = useMemo(
    () => groupTimelineBlocks(visibleEntries),
    [visibleEntries]
  );

  const hourlyBuckets = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        moments: Array<{
          id: string;
          participantId: string;
          name: string;
          photoUrl: string;
          caption: string;
          createdAt: string;
        }>;
        checkins: Array<{ participantId: string; name: string; timestamp: string; note: string }>;
      }
    >();

    for (const entry of visibleEntries) {
      const bucket = formatHourBucket(entry.timestamp);
      let group = map.get(bucket.key);
      if (!group) {
        group = { label: bucket.label, moments: [], checkins: [] };
        map.set(bucket.key, group);
      }
      if (entry.kind === 'moment') {
        group.moments.push({
          id: entry.id.replace(/^moment:/, ''),
          participantId: entry.participantId,
          name: entry.name,
          photoUrl: entry.photoUrl,
          caption: entry.caption,
          createdAt: entry.timestamp,
        });
      } else {
        group.checkins.push({
          participantId: entry.participantId,
          name: entry.name,
          timestamp: entry.timestamp,
          note: entry.note,
        });
      }
    }
    return Array.from(map.entries());
  }, [visibleEntries]);

  function handleApplyPendingUpdates() {
    setHeldSnapshot(null);
    setExtraEntries(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLoadMore() {
    if (canShowMoreLocal) {
      setVisibleLimit((prev) => prev + INITIAL_VISIBLE_LIMIT);
      return;
    }
    if (!hasMoreRemote || !remoteCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const pt = getParticipantToken(snapshot.code);
      const headers: Record<string, string> = {};
      if (pt) headers['x-participant-token'] = pt;
      const params = new URLSearchParams({
        order,
        cursor: remoteCursor,
        limit: String(INITIAL_VISIBLE_LIMIT),
      });
      if (selectedPersonId) params.set('participantId', selectedPersonId);
      const res = await fetch(`/api/rooms/${snapshot.code}/timeline?${params.toString()}`, {
        headers,
      });
      if (!res.ok) return;
      const page = (await res.json()) as TimelinePage;
      setExtraEntries((prev) => [...(prev ?? allEntries), ...page.items]);
      setHasMoreRemote(page.hasMore);
      setRemoteCursor(page.nextCursor);
      setVisibleLimit((prev) => prev + page.items.length);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleOneTapCheckin(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitting(true);
    try {
      setHeldSnapshot(null);
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
      setHeldSnapshot(null);
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
      setHeldSnapshot(null);
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

  function openMomentsLightbox(
    items: Array<{
      id: string;
      participantId: string;
      authorName: string;
      photoUrl: string;
      caption: string;
      createdAt: string;
    }>,
    index = 0
  ) {
    if (items.length === 0) return;
    setLightboxItems(items);
    setLightboxIndex(Math.max(0, Math.min(index, items.length - 1)));
  }

  const activeLightboxItem =
    lightboxItems.length > 0
      ? lightboxItems[Math.min(lightboxIndex, lightboxItems.length - 1)]
      : null;

  // Khi đang cuộn xuống và snapshot prop có thêm mục mới, giữ bản snapshot cũ cho tới khi user bấm nút nổi
  const liveItemCount = countEntries(snapshot);
  const heldItemCount = heldSnapshot ? heldSnapshot.baseCount : liveItemCount;
  const showFloatingNewBtn =
    pendingNewCount > 0 || (scrolledDown && liveItemCount > heldItemCount);

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

      {/* Nút nổi báo mục mới khi người dùng đang cuộn xuống đọc mục cũ */}
      <AnimatePresence>
        {showFloatingNewBtn && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={handleApplyPendingUpdates}
            className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-extrabold text-[var(--primary-fg)] shadow-xl shadow-black/30 transition hover:scale-105"
          >
            ↑ {Math.max(1, pendingNewCount || liveItemCount - heldItemCount)} mục mới
          </motion.button>
        )}
      </AnimatePresence>

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
                  ✨ Đã kết thúc · Album kỷ niệm
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

        {/* Grid Table thành viên (hiển thị ngay trong phần Đang diễn ra; chưa có ảnh hiện icon chuyển động, có ảnh thay icon bằng ảnh) */}
        {isLive && roomGridPeople.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-semibold">
                Bảng thành viên ({roomGridPeople.length})
              </span>
              <span>
                {roomGridPeople.filter((p) => Boolean(p.photoUrl)).length}/{roomGridPeople.length} đã đăng ảnh
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {roomGridPeople.map((person, idx) => {
                const isMe = person.id === myParticipantId;
                const theme = CUTE_THEMES[idx % CUTE_THEMES.length];
                const hasPhoto = Boolean(person.photoUrl);

                if (hasPhoto) {
                  const lightboxPayload =
                    person.moments.length > 0
                      ? person.moments.map((m) => ({ ...m, authorName: person.name }))
                      : [
                          {
                            id: `checkin-${person.id}`,
                            participantId: person.id,
                            photoUrl: person.photoUrl,
                            caption: '',
                            createdAt: snapshot.serverTime || new Date().toISOString(),
                            authorName: person.name,
                          },
                        ];

                  return (
                    <motion.div
                      key={person.id}
                      layout
                      className={`group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border bg-[var(--surface-solid)] ${
                        isMe
                          ? 'border-[var(--primary)]/60 ring-2 ring-[var(--primary)]/35'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openMomentsLightbox(lightboxPayload, 0)}
                        className="absolute inset-0 h-full w-full text-left"
                        aria-label={`Xem ảnh của ${person.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={person.photoUrl}
                          alt={`Khoảnh khắc của ${person.name}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />
                      </button>

                      <div className="relative z-10 flex items-center justify-between gap-1 p-2">
                        {person.moments.length > 1 ? (
                          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md tabular-nums">
                            📸 {person.moments.length}
                          </span>
                        ) : (
                          <span />
                        )}
                        {isMe && canAddMoreMoments && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openComposer();
                            }}
                            className="rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md transition hover:bg-black/90"
                          >
                            + Ảnh
                          </button>
                        )}
                      </div>

                      <div className="pointer-events-none relative z-10 p-2.5 text-white">
                        <p className="truncate text-xs font-extrabold">
                          {isMe ? 'Bạn' : person.name}
                        </p>
                        {person.moments[0]?.caption && (
                          <p className="line-clamp-1 text-[10px] text-white/85">
                            {person.moments[0].caption}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={person.id}
                    layout
                    onClick={() => {
                      if (isMe && canAddMoreMoments) openComposer();
                    }}
                    role={isMe && canAddMoreMoments ? 'button' : undefined}
                    tabIndex={isMe && canAddMoreMoments ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isMe && canAddMoreMoments && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openComposer();
                      }
                    }}
                    className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center backdrop-blur-sm ${theme.bg} ${
                      isMe && canAddMoreMoments
                        ? 'cursor-pointer ring-2 ring-[var(--primary)]/50 transition hover:scale-[1.02]'
                        : ''
                    }`}
                  >
                    <motion.div
                      animate={{
                        y: [0, -6, 0],
                        rotate: [0, -4, 4, 0],
                      }}
                      transition={{
                        duration: 2.4 + (idx % 3) * 0.35,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: (idx % 4) * 0.2,
                      }}
                      className="select-none text-4xl drop-shadow-sm"
                    >
                      {theme.emoji}
                    </motion.div>
                    <p className={`max-w-full truncate text-xs font-extrabold ${theme.text}`}>
                      {isMe ? 'Bạn' : person.name}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--muted)]">
                      {isMe
                        ? 'Chạm để đăng ảnh'
                        : person.checkedIn
                          ? 'Đã đến · Đợi ảnh...'
                          : 'Đang đợi...'}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

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

      {/* Dòng thời gian / Album theo khung giờ */}
      <div className="glass-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">
              {activeView === 'timeline' ? 'Dòng thời gian' : 'Album theo khung giờ'}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {activeView === 'timeline'
                ? 'Mới nhất ở trên đầu · Gộp ảnh đăng liền nhau'
                : 'Xếp từ đầu kèo đến cuối kèo theo từng khung giờ'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chuyển chế độ hiển thị */}
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setViewOverride('timeline');
                  setExtraEntries(null);
                  setVisibleLimit(INITIAL_VISIBLE_LIMIT);
                }}
                className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${
                  activeView === 'timeline'
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                Dòng thời gian
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewOverride('hourly');
                  setExtraEntries(null);
                  setVisibleLimit(INITIAL_VISIBLE_LIMIT);
                }}
                className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${
                  activeView === 'hourly'
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                Khung giờ
              </button>
            </div>

            {canAddMoreMoments && (
              <button
                type="button"
                onClick={openComposer}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <span>📸</span>
                <span>Đăng ảnh ({myMomentsCount}/{MAX_MOMENTS})</span>
              </button>
            )}
          </div>
        </div>

        {/* Dải avatar lọc theo người */}
        {activeSnapshot.checkins.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedPersonId(null);
                setExtraEntries(null);
                setVisibleLimit(INITIAL_VISIBLE_LIMIT);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                selectedPersonId === null
                  ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Tất cả ({activeSnapshot.checkins.length})
            </button>

            {activeSnapshot.checkins.map((person) => {
              const selected = selectedPersonId === person.participantId;
              return (
                <button
                  key={person.participantId}
                  type="button"
                  onClick={() => {
                    setSelectedPersonId(selected ? null : person.participantId);
                    setExtraEntries(null);
                    setVisibleLimit(INITIAL_VISIBLE_LIMIT);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-semibold transition ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  <UserAvatar name={person.name} size="sm" />
                  <span>{person.name}</span>
                  {person.moments.length > 0 && (
                    <span className="rounded-full bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] tabular-nums">
                      {person.moments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {visibleEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            {selectedPersonId
              ? 'Người này chưa có hoạt động nào.'
              : 'Chưa có ai check-in hoặc đăng ảnh. Hãy là người đầu tiên nhé!'}
          </div>
        ) : activeView === 'timeline' ? (
          /* CÁCH 1: DÒNG THỜI GIAN DỌC */
          <div className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-0.5 before:bg-[var(--border)]">
            <AnimatePresence initial={false}>
              {timelineBlocks.map((block) => {
                if (block.kind === 'checkin') {
                  return (
                    <motion.div
                      key={block.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-solid)]/60 px-3.5 py-2.5 text-xs"
                    >
                      <span className="absolute -left-[22px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[var(--bg)] bg-emerald-400" />
                      <UserAvatar name={block.name} size="sm" />
                      <span className="font-semibold text-[var(--text)]">
                        {block.name}
                      </span>
                      <span className="text-[var(--muted)]">
                        đã đến · <span className="tabular-nums">{formatLocalTime(block.timestamp)}</span>
                      </span>
                      {block.note && (
                        <span className="rounded-lg bg-[var(--bg)] px-2 py-0.5 text-[var(--text)]/90">
                          “{block.note}”
                        </span>
                      )}
                    </motion.div>
                  );
                }

                // Mục ảnh khoảnh khắc (đã gộp ảnh liền nhau trong 5 phút)
                const photosCount = block.moments.length;
                const displayMoments = block.moments.slice(0, 4);
                const extraCount = Math.max(0, photosCount - 4);
                const lightboxPayload = block.moments.map((m) => ({
                  ...m,
                  participantId: block.participantId,
                  authorName: block.name,
                }));

                return (
                  <motion.div
                    key={block.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)]/90 p-3.5 sm:p-4"
                  >
                    <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full border-2 border-[var(--bg)] bg-[var(--primary)] ring-2 ring-[var(--primary)]/25" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={block.name} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text)]">
                            {block.name}
                          </p>
                          <p className="text-[11px] text-[var(--muted)] tabular-nums">
                            {formatLocalTime(block.timestamp)}
                            {photosCount > 1 ? ` · ${photosCount} khoảnh khắc` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lưới ảnh: 1 ảnh giữ đúng tỷ lệ vừa mắt không cắt, 2-4+ ảnh lưới 2x2 gọn gàng */}
                    {displayMoments.length === 1 ? (
                      <button
                        type="button"
                        onClick={() => openMomentsLightbox(lightboxPayload, 0)}
                        className="group relative inline-block max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-black/25 text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayMoments[0].photoUrl}
                          alt={displayMoments[0].caption || `Khoảnh khắc của ${block.name}`}
                          loading="lazy"
                          decoding="async"
                          className="max-h-72 w-auto max-w-full object-contain transition duration-300 group-hover:scale-[1.02] sm:max-h-80"
                        />
                      </button>
                    ) : (
                      <div className="grid max-w-md grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
                        {displayMoments.map((m, idx) => {
                          const isLastOverflow = idx === 3 && extraCount > 0;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => openMomentsLightbox(lightboxPayload, idx)}
                              className={`group relative overflow-hidden rounded-xl bg-black/20 text-left ${
                                displayMoments.length === 3 && idx === 0
                                  ? 'col-span-2 aspect-[16/9]'
                                  : 'aspect-square'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.photoUrl}
                                alt={m.caption || `Khoảnh khắc của ${block.name}`}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                              {isLastOverflow && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-extrabold text-white">
                                  +{extraCount}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Caption riêng cho từng ảnh */}
                    {block.moments.some((m) => m.caption) && (
                      <div className="space-y-1 pt-0.5">
                        {block.moments
                          .filter((m) => m.caption)
                          .map((m) => (
                            <p
                              key={m.id}
                              className="break-words text-sm leading-relaxed text-[var(--text)]/95"
                            >
                              {block.moments.length > 1 && (
                                <span className="mr-1.5 text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                                  [{formatLocalTime(m.createdAt)}]
                                </span>
                              )}
                              {m.caption}
                            </p>
                          ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* CÁCH 2: GOM THEO KHUNG GIỜ (ALBUM SAU KÈO) */
          <div className="space-y-6">
            {hourlyBuckets.map(([bucketKey, group]) => (
              <section key={bucketKey} className="space-y-3">
                <div className="sticky top-14 z-10 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 backdrop-blur-md">
                  <span className="font-display text-sm font-bold text-[var(--primary)] tabular-nums">
                    🕒 {group.label}
                  </span>
                  <span className="text-[11px] text-[var(--muted)] tabular-nums">
                    {group.moments.length} ảnh · {group.checkins.length} check-in
                  </span>
                </div>

                {group.checkins.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {group.checkins.map((c) => (
                      <span
                        key={`${c.participantId}-${c.timestamp}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 py-1 text-[11px] text-[var(--muted)]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <strong className="text-[var(--text)]">{c.name}</strong> đến lúc{' '}
                        {formatLocalTime(c.timestamp)}
                        {c.note ? ` — “${c.note}”` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {group.moments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {group.moments.map((m, idx) => {
                      const lightboxPayload = group.moments.map((item) => ({
                        ...item,
                        authorName: item.name,
                      }));
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => openMomentsLightbox(lightboxPayload, idx)}
                          className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.photoUrl}
                            alt={m.caption || `Ảnh của ${m.name}`}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                          <div className="relative z-10 space-y-0.5 p-2.5 text-white">
                            <p className="truncate text-xs font-bold">{m.name}</p>
                            {m.caption && (
                              <p className="line-clamp-2 text-[11px] text-white/85">
                                {m.caption}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {(canShowMoreLocal || hasMoreRemote) && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-2 text-xs font-bold text-[var(--text)] transition hover:border-[var(--primary)] disabled:opacity-50"
            >
              {loadingMore ? 'Đang tải thêm…' : 'Xem thêm mục cũ hơn'}
            </button>
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
                Hệ thống sẽ khóa check-in và đăng ảnh mới. Toàn bộ dòng thời gian sẽ chuyển sang Album theo khung giờ.
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

      {/* Lightbox Carousel xem ảnh lớn */}
      <AnimatePresence>
        {activeLightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setLightboxItems([])}
          >
            <div
              className="flex w-full max-w-2xl flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={activeLightboxItem.authorName} size="sm" />
                  <div>
                    <p className="text-sm font-bold">{activeLightboxItem.authorName}</p>
                    <p className="text-[11px] text-white/70 tabular-nums">
                      {formatLocalTime(activeLightboxItem.createdAt)} · Ảnh {lightboxIndex + 1}/{lightboxItems.length}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(isOwner || activeLightboxItem.participantId === myParticipantId) &&
                    !activeLightboxItem.id.startsWith('checkin-') && (
                      <button
                        type="button"
                        onClick={async () => {
                          const removedId = activeLightboxItem.id;
                          await onDeleteMoment(removedId);
                          const next = lightboxItems.filter((x) => x.id !== removedId);
                          setLightboxItems(next);
                          if (next.length > 0) {
                            setLightboxIndex((i) => Math.min(i, next.length - 1));
                          }
                        }}
                        className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/35"
                      >
                        🗑 Xóa
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setLightboxItems([])}
                    className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightboxItem.photoUrl}
                  alt={activeLightboxItem.caption || `Khoảnh khắc của ${activeLightboxItem.authorName}`}
                  className="max-h-[68vh] w-full object-contain"
                />

                {lightboxItems.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((i) =>
                          i === 0 ? lightboxItems.length - 1 : i - 1
                        )
                      }
                      className="absolute left-2 rounded-full bg-black/60 px-3 py-2 text-sm font-bold text-white backdrop-blur-md hover:bg-black/80"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((i) => (i + 1) % lightboxItems.length)
                      }
                      className="absolute right-2 rounded-full bg-black/60 px-3 py-2 text-sm font-bold text-white backdrop-blur-md hover:bg-black/80"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {activeLightboxItem.caption && (
                <p className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm text-white">
                  “{activeLightboxItem.caption}”
                </p>
              )}

              {lightboxItems.length > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto py-1">
                  {lightboxItems.map((m, idx) => (
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
