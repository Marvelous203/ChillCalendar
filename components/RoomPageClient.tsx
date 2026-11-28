'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence } from 'motion/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { FinalBanner } from '@/components/FinalBanner';
import { LiveRoomPanel } from '@/components/LiveRoomPanel';
import { ManageSheet } from '@/components/ManageSheet';
import { NameSheet } from '@/components/NameSheet';
import { PlacesPanel } from '@/components/PlacesPanel';
import { PrivateRoomGate } from '@/components/PrivateRoomGate';
import { ResultsPanel } from '@/components/ResultsPanel';
import { RoomCodeChip } from '@/components/RoomCodeChip';
import { SaveBar } from '@/components/SaveBar';
import { ShareRoomButton } from '@/components/ShareRoomButton';
import { RoomSkeleton } from '@/components/Skeletons';
import { Tabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import {
  getParticipantToken,
  setParticipantToken,
} from '@/lib/participant-token';
import { normalizeCode } from '@/lib/room-code';
import { useLiveRoom } from '@/lib/use-live-room';
import type {
  FinalizePolicy,
  ItineraryStop,
  LiveSnapshot,
  PlaceType,
  ReactionEmoji,
  RoomBundle,
  Visibility,
} from '@/lib/types';

type RoomTab = 'live' | 'grid' | 'results' | 'places';

interface PrivateError {
  private?: boolean;
  pending?: boolean;
  removed?: boolean;
  error?: string;
}

class RoomFetchError extends Error {
  status: number;
  payload: PrivateError;
  constructor(status: number, payload: PrivateError) {
    super(payload.error ?? 'Lỗi tải phòng');
    this.status = status;
    this.payload = payload;
  }
}

const subscribeNoop = () => () => { };

export function RoomPageClient() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const code = normalizeCode(params.code ?? '');
  const inviteToken = searchParams.get('i') ?? undefined;

  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  const apiUrl = useMemo(() => {
    if (!code) return null;
    return inviteToken
      ? `/api/rooms/${code}?i=${encodeURIComponent(inviteToken)}`
      : `/api/rooms/${code}`;
  }, [code, inviteToken]);

  const { data, error, isLoading, mutate } = useSWR<RoomBundle, RoomFetchError>(
    isClient && apiUrl ? apiUrl : null,
    async (url: string) => {
      const pt = getParticipantToken(code);
      const headers: Record<string, string> = {};
      if (pt) headers['x-participant-token'] = pt;
      const res = await fetch(url, { headers });
      const json = (await res.json()) as RoomBundle & PrivateError;
      if (!res.ok) {
        throw new RoomFetchError(res.status, json);
      }
      if (json.autoParticipantToken) {
        setParticipantToken(code, json.autoParticipantToken);
      }
      return json;
    },
    { refreshInterval: 8000, keepPreviousData: true }
  );

  const [tabOverride, setTabOverride] = useState<RoomTab | null>(null);
  const [draftSlots, setDraftSlots] = useState<string[] | null>(null);
  const [savingSlots, setSavingSlots] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const fallbackLive: LiveSnapshot = useMemo(
    () => ({
      code,
      status: 'voting',
      liveFrom: null,
      autoEndAt: null,
      endedAt: null,
      endedBy: null,
      counts: { checkedIn: 0, expected: 0 },
      checkins: [],
      notArrived: [],
      serverTime: '',
    }),
    [code]
  );

  const {
    snapshot: liveSnapshot,
    setSnapshot: setLiveSnapshot,
    connectionMode,
    sendReactionBurst,
  } = useLiveRoom({
    code,
    status: data?.event.status ?? 'voting',
    initialSnapshot: data?.live ?? fallbackLive,
    onStatusChange: () => {
      void mutate();
    },
    onReactionBurst: (momentId, emoji, count) => {
      window.dispatchEvent(
        new CustomEvent('cwm-reaction-burst', {
          detail: { momentId, emoji, count },
        })
      );
    },
  });

  const isLiveOrDone = liveSnapshot.status === 'live' || liveSnapshot.status === 'done';
  const tab: RoomTab = tabOverride ?? (isLiveOrDone ? 'live' : 'grid');
  const setTab = (next: RoomTab) => setTabOverride(next);

  const serverSlots = useMemo(() => {
    if (!data?.me) return [];
    return (
      data.responses.find((r) => r.participantId === data.me?.id)?.slots ?? []
    );
  }, [data]);

  const activeSlots = draftSlots ?? serverSlots;
  const isDirty =
    draftSlots !== null &&
    [...draftSlots].sort().join(',') !== [...serverSlots].sort().join(',');

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const pt = getParticipantToken(code);
    if (pt) h['x-participant-token'] = pt;
    return h;
  }

  async function handleJoin(name: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, inviteToken }),
      });
      const json = (await res.json()) as {
        participantToken?: string;
        status?: string;
        bundle?: RoomBundle | null;
        error?: string;
      };
      if (!res.ok) {
        toast(json.error ?? 'Không vào được phòng', 'error');
        return;
      }
      if (json.participantToken) {
        setParticipantToken(code, json.participantToken);
      }
      if (json.bundle) {
        await mutate(json.bundle, { revalidate: false });
      } else {
        await mutate();
      }
      toast(
        json.status === 'pending'
          ? 'Đã gửi yêu cầu, chờ chủ phòng duyệt nhé!'
          : `Chào ${name}! Hãy chọn giờ bạn rảnh.`,
        'success'
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleSaveSlots() {
    if (!draftSlots) return;
    setSavingSlots(true);
    try {
      const res = await fetch(`/api/rooms/${code}/response`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ slots: draftSlots }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(json.error ?? 'Không lưu được giờ rảnh', 'error');
        return;
      }
      setDraftSlots(null);
      await mutate();
      toast('Đã lưu giờ rảnh của bạn!', 'success');
    } finally {
      setSavingSlots(false);
    }
  }

  async function handleAddPlace(payload: {
    type: PlaceType;
    name: string;
    addr: string;
    link: string;
    imageUrl: string;
    note: string;
    stops: ItineraryStop[];
  }) {
    const res = await fetch(`/api/rooms/${code}/places`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? 'Không thêm được quán');
    await mutate();
    toast(
      payload.type === 'itinerary' ? 'Đã thêm lộ trình!' : 'Đã thêm địa điểm!',
      'success'
    );
  }

  async function handleEditPlace(
    placeId: string,
    payload: {
      type: PlaceType;
      name: string;
      addr: string;
      link: string;
      imageUrl: string;
      note: string;
      stops: ItineraryStop[];
    }
  ) {
    const res = await fetch(`/api/rooms/${code}/places`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ placeId, ...payload }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? 'Không cập nhật được địa điểm');
    await mutate();
    toast('Đã cập nhật địa điểm!', 'success');
  }

  async function handleDeletePlace(placeId: string) {
    const res = await fetch(
      `/api/rooms/${code}/places?placeId=${encodeURIComponent(placeId)}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    if (!res.ok) {
      toast('Không xóa được địa điểm', 'error');
      return;
    }
    await mutate();
  }

  async function handleToggleVote(placeId: string, nextOn: boolean) {
    if (!data?.me) return;
    const myId = data.me.id;
    await mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          places: prev.places.map((p) =>
            p.id === placeId
              ? {
                ...p,
                votedByMe: nextOn,
                voteCount: Math.max(0, p.voteCount + (nextOn ? 1 : -1)),
                voterIds: nextOn
                  ? [...p.voterIds, myId]
                  : p.voterIds.filter((id) => id !== myId),
              }
              : p
          ),
        };
      },
      { revalidate: false }
    );

    const res = await fetch(`/api/rooms/${code}/votes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ placeId, on: nextOn }),
    });
    if (!res.ok) toast('Không cập nhật được bình chọn', 'error');
    await mutate();
  }

  async function handleFinalize(payload: {
    date: string;
    from: number;
    to: number;
    placeId: string | null;
  }) {
    const res = await fetch(`/api/rooms/${code}/finalize`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as RoomBundle & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không chốt được lịch', 'error');
      return;
    }
    await mutate(json, { revalidate: false });
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#0FA3A3', '#FF8A5B', '#3DD0C6'],
    });
    toast('Đã chốt lịch hẹn thành công!', 'success');
  }

  async function handleUnfinalize() {
    const res = await fetch(`/api/rooms/${code}/finalize`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      toast('Không thể bỏ chốt', 'error');
      return;
    }
    await mutate();
    toast('Đã bỏ chốt lịch', 'info');
  }

  async function handleStartEarly() {
    const res = await fetch(`/api/rooms/${code}/start-early`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const json = (await res.json()) as RoomBundle & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể bắt đầu sớm', 'error');
      return;
    }
    await mutate(json, { revalidate: false });
    setTabOverride('live');
    toast('Đã bật chế độ Đang diễn ra!', 'success');
  }

  async function handleCheckin(payload: { note?: string; photoUrl?: string }) {
    const res = await fetch(`/api/rooms/${code}/checkin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as LiveSnapshot & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể check-in', 'error');
      return;
    }
    setLiveSnapshot(json);
    if (payload.note !== undefined || payload.photoUrl !== undefined) {
      toast('Đã cập nhật check-in!', 'success');
    } else {
      toast('Đã ghi nhận bạn đã đến!', 'success');
    }
  }

  async function handleAddMoment(payload: { photoUrl: string; caption: string; sticker?: string }) {
    const res = await fetch(`/api/rooms/${code}/moments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as LiveSnapshot & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể đăng khoảnh khắc', 'error');
      throw new Error(json.error ?? 'Không thể đăng khoảnh khắc');
    }
    setLiveSnapshot(json);
    toast('Đã đăng khoảnh khắc mới!', 'success');
  }

  async function handleReactMoment(
    momentId: string,
    emoji: ReactionEmoji,
    mode: 'toggle' | 'set'
  ) {
    const res = await fetch(`/api/rooms/${code}/moments/react`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ momentId, emoji, mode }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as {
      momentId: string;
      reactions: Partial<Record<ReactionEmoji, number>>;
      myReactions: ReactionEmoji[];
      totalReactions: number;
    };
    setLiveSnapshot({
      ...liveSnapshot,
      checkins: liveSnapshot.checkins.map((c) => ({
        ...c,
        moments: c.moments.map((m) =>
          m.id === json.momentId
            ? {
                ...m,
                reactions: json.reactions,
                myReactions: json.myReactions,
                totalReactions: json.totalReactions,
              }
            : m
        ),
      })),
      serverTime: new Date().toISOString(),
    });
  }

  async function handlePinMoment(momentId: string, pinned: boolean) {
    const res = await fetch(`/api/rooms/${code}/moments/pin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ momentId, pinned }),
    });
    const json = (await res.json()) as LiveSnapshot & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể ghim khoảnh khắc', 'error');
      return;
    }
    setLiveSnapshot(json);
    toast(pinned ? 'Đã ghim khoảnh khắc lên đầu!' : 'Đã bỏ ghim khoảnh khắc', 'info');
  }

  async function handleDeleteMoment(momentId: string) {
    const res = await fetch(
      `/api/rooms/${code}/moments?momentId=${encodeURIComponent(momentId)}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    const json = (await res.json()) as LiveSnapshot & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể xóa ảnh', 'error');
      return;
    }
    setLiveSnapshot(json);
    toast('Đã xóa ảnh khoảnh khắc', 'info');
  }

  async function handleEndLive() {
    const res = await fetch(`/api/rooms/${code}/end`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const json = (await res.json()) as RoomBundle & { error?: string };
    if (!res.ok) {
      toast(json.error ?? 'Không thể kết thúc sự kiện', 'error');
      return;
    }
    await mutate(json, { revalidate: false });
    toast('Sự kiện đã kết thúc. Dữ liệu kỷ niệm đã được lưu!', 'info');
  }

  if (error?.status === 403 && error.payload.private) {
    return (
      <PrivateRoomGate
        code={code}
        pending={Boolean(error.payload.pending)}
        removed={Boolean(error.payload.removed)}
        submitting={joining}
        onRequestJoin={handleJoin}
      />
    );
  }

  if (error) {
    return (
      <div className="glass-card mx-auto max-w-md p-8 text-center">
        <p className="font-display text-lg font-bold">Không tìm thấy phòng #{code}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">{error.message}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return <RoomSkeleton />;
  }

  const finalPlace =
    data.places.find((p) => p.id === data.event.finalPlaceId) ?? null;

  return (
    <div className="space-y-5 pb-24">
      <div className="glass-card flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <RoomCodeChip code={data.event.code} />
            {data.event.visibility === 'private' && (
              <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]">
                🔒 Riêng tư
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            {data.event.title}
          </h1>
          {data.event.note && (
            <p className="text-sm text-[var(--muted)]">{data.event.note}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareRoomButton
            code={data.event.code}
            title={data.event.title}
            inviteToken={data.event.inviteToken}
            isPrivate={data.event.visibility === 'private'}
          />
          {data.me && (
            <>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-semibold">
                Bạn: {data.me.name}
              </span>
              {/* <button
                type="button"
                onClick={() => {
                  clearParticipantToken(code);
                  setTokenOverride(null);
                  setDraftSlots(null);
                }}
                className="rounded-full border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
                title="Đổi sang tên khác"
              >
                Đổi người
              </button> */}
            </>
          )}
          {data.permissions.isOwner && (
            <button
              type="button"
              onClick={() => setShowManage(true)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-1.5 text-xs font-bold transition hover:border-[var(--primary)]"
            >
              ⚙ Quản lý
            </button>
          )}
        </div>
      </div>

      {data.event.finalDate &&
        data.event.finalFrom !== null &&
        data.event.finalTo !== null && (
          <FinalBanner
            title={data.event.title}
            note={data.event.note}
            finalDate={data.event.finalDate}
            finalFrom={data.event.finalFrom}
            finalTo={data.event.finalTo}
            finalPlace={finalPlace}
            finalizedBy={data.event.finalizedBy}
            status={liveSnapshot.status}
            liveFrom={liveSnapshot.liveFrom}
            canUnfinalize={data.permissions.canFinalize}
            canStartEarly={data.permissions.canStartEarly}
            onUnfinalize={handleUnfinalize}
            onStartEarly={handleStartEarly}
          />
        )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ...(isLiveOrDone
            ? [
                {
                  id: 'live' as const,
                  label: liveSnapshot.status === 'live' ? '● Đang diễn ra' : '✨ Đã kết thúc',
                  badge: `${liveSnapshot.counts.checkedIn}/${liveSnapshot.counts.expected}`,
                },
              ]
            : []),
          { id: 'grid', label: 'Giờ rảnh' },
          {
            id: 'results',
            label: 'Kết quả',
            badge: data.participants.filter((p) => p.status === 'approved').length,
          },
          { id: 'places', label: 'Địa điểm', badge: data.places.length },
        ]}
      />

      {tab === 'live' && isLiveOrDone && (
        <LiveRoomPanel
          snapshot={liveSnapshot}
          participants={data.participants}
          connectionMode={connectionMode}
          myParticipantId={data.me?.id ?? null}
          isOwner={data.permissions.isOwner}
          canCheckin={data.permissions.canCheckin}
          canEndLive={data.permissions.canEndLive}
          onCheckin={handleCheckin}
          onAddMoment={handleAddMoment}
          onReactMoment={handleReactMoment}
          onPinMoment={handlePinMoment}
          onSendBurst={sendReactionBurst}
          onDeleteMoment={handleDeleteMoment}
          onEndLive={handleEndLive}
        />
      )}

      {tab === 'grid' && (
        <AvailabilityGrid
          dates={data.event.dates}
          hourFrom={data.event.hourFrom}
          hourTo={data.event.hourTo}
          selectedSlots={activeSlots}
          onChange={setDraftSlots}
          disabled={!data.me || data.me.status !== 'approved'}
          onDisabledClick={() =>
            toast(
              !data.me
                ? 'Hãy nhập tên của bạn trước khi chọn giờ'
                : 'Yêu cầu của bạn đang chờ chủ phòng duyệt',
              'info'
            )
          }
        />
      )}

      {tab === 'results' && (
        <ResultsPanel
          dates={data.event.dates}
          hourFrom={data.event.hourFrom}
          hourTo={data.event.hourTo}
          participants={data.participants}
          responses={data.responses}
          places={data.places}
          canFinalize={data.permissions.canFinalize}
          onFinalize={handleFinalize}
        />
      )}

      {tab === 'places' && (
        <PlacesPanel
          places={data.places}
          isOwner={data.permissions.isOwner}
          myParticipantId={data.me?.id ?? null}
          canParticipate={data.permissions.canParticipate}
          onAddPlace={handleAddPlace}
          onEditPlace={handleEditPlace}
          onDeletePlace={handleDeletePlace}
          onToggleVote={handleToggleVote}
        />
      )}

      <SaveBar
        dirty={isDirty}
        saving={savingSlots}
        count={activeSlots.length}
        onSave={handleSaveSlots}
        onDiscard={() => setDraftSlots(null)}
      />

      {!data.me && (
        <NameSheet
          isPrivate={data.event.visibility === 'private' && !inviteToken}
          submitting={joining}
          onSubmit={handleJoin}
        />
      )}

      <AnimatePresence>
        {showManage && (
          <ManageSheet
            code={data.event.code}
            title={data.event.title}
            note={data.event.note}
            visibility={data.event.visibility}
            finalizePolicy={data.event.finalizePolicy}
            inviteToken={data.event.inviteToken}
            participants={data.participants}
            onClose={() => setShowManage(false)}
            onUpdateSettings={async (patch: {
              title: string;
              note: string;
              visibility: Visibility;
              finalizePolicy: FinalizePolicy;
            }) => {
              const res = await fetch(`/api/rooms/${code}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(patch),
              });
              if (!res.ok) {
                toast('Không lưu được cài đặt', 'error');
                return;
              }
              await mutate();
              toast('Đã cập nhật cài đặt', 'success');
            }}
            onRotateCode={async () => {
              const res = await fetch(`/api/rooms/${code}/rotate-code`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ rotateInvite: true }),
              });
              const json = (await res.json()) as RoomBundle & { error?: string };
              if (!res.ok) {
                toast(json.error ?? 'Không đổi được mã phòng', 'error');
                return;
              }
              toast(`Đã đổi sang mã #${json.event.code}`, 'success');
              setShowManage(false);
              router.replace(`/e/${json.event.code}`);
            }}
            onUpdateMember={async (id, status) => {
              const res = await fetch(`/api/rooms/${code}/members/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ status }),
              });
              if (!res.ok) {
                toast('Không cập nhật được thành viên', 'error');
                return;
              }
              await mutate();
            }}
            onDeleteRoom={async () => {
              const res = await fetch(`/api/rooms/${code}`, {
                method: 'DELETE',
                headers: authHeaders(),
              });
              if (!res.ok) {
                toast('Không xóa được phòng', 'error');
                return;
              }
              toast('Đã xóa sự kiện', 'info');
              router.replace('/');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
