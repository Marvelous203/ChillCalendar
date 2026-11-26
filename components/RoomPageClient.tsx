'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence } from 'motion/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { FinalBanner } from '@/components/FinalBanner';
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
  clearParticipantToken,
  getParticipantToken,
  setParticipantToken,
} from '@/lib/participant-token';
import { normalizeCode } from '@/lib/room-code';
import type {
  FinalizePolicy,
  ItineraryStop,
  PlaceType,
  RoomBundle,
  Visibility,
} from '@/lib/types';

type RoomTab = 'grid' | 'results' | 'places';

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
  const [tokenOverride, setTokenOverride] = useState<string | null | undefined>(undefined);
  const token =
    tokenOverride !== undefined
      ? tokenOverride
      : isClient
        ? getParticipantToken(code)
        : null;
  const tokenReady = isClient;

  const apiUrl = useMemo(() => {
    if (!code) return null;
    return inviteToken
      ? `/api/rooms/${code}?i=${encodeURIComponent(inviteToken)}`
      : `/api/rooms/${code}`;
  }, [code, inviteToken]);

  const { data, error, isLoading, mutate } = useSWR<RoomBundle, RoomFetchError>(
    tokenReady && apiUrl ? [apiUrl, token] : null,
    async ([url, pt]: [string, string | null]) => {
      const headers: Record<string, string> = {};
      if (pt) headers['x-participant-token'] = pt;
      const res = await fetch(url, { headers });
      const json = (await res.json()) as RoomBundle & PrivateError;
      if (!res.ok) {
        throw new RoomFetchError(res.status, json);
      }
      return json;
    },
    { refreshInterval: 8000, keepPreviousData: true }
  );

  const [tab, setTab] = useState<RoomTab>('grid');
  const [draftSlots, setDraftSlots] = useState<string[] | null>(null);
  const [savingSlots, setSavingSlots] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showManage, setShowManage] = useState(false);

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
    if (token) h['x-participant-token'] = token;
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
        setTokenOverride(json.participantToken);
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
            canUnfinalize={data.permissions.canFinalize}
            onUnfinalize={handleUnfinalize}
          />
        )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'grid', label: 'Giờ rảnh' },
          {
            id: 'results',
            label: 'Kết quả',
            badge: data.participants.filter((p) => p.status === 'approved').length,
          },
          { id: 'places', label: 'Địa điểm', badge: data.places.length },
        ]}
      />

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
