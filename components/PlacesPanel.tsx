'use client';

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { itineraryMapsUrl } from '@/lib/maps';
import { canDeletePlace } from '@/lib/permissions';
import type { ItineraryStop, PlaceCategory, PlaceType, PublicPlace } from '@/lib/types';
import { AddPlaceSheet } from './AddPlaceSheet';

const CAT_ICON: Record<PlaceCategory, string> = {
  checkin: '📸',
  food: '🍜',
  cafe: '☕',
  play: '🎤',
};

export function PlacesPanel({
  places,
  isOwner,
  myParticipantId,
  canParticipate,
  onAddPlace,
  onDeletePlace,
  onToggleVote,
}: {
  places: PublicPlace[];
  isOwner: boolean;
  myParticipantId: string | null;
  canParticipate: boolean;
  onAddPlace: (payload: {
    type: PlaceType;
    name: string;
    addr: string;
    link: string;
    imageUrl: string;
    note: string;
    stops: ItineraryStop[];
  }) => Promise<void>;
  onDeletePlace: (placeId: string) => Promise<void>;
  onToggleVote: (placeId: string, nextOn: boolean) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const sorted = [...places].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="font-display text-base font-bold">Đề xuất & Bình chọn địa điểm</h3>
          <p className="text-xs text-[var(--muted)]">
            Tìm địa chỉ tự động khi gõ hoặc tạo lộ trình nhiều chặng (Check-in → Ăn uống → Cà phê).
          </p>
        </div>
        {canParticipate && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90"
          >
            + Đề xuất
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-[var(--muted)]">
          Chưa có địa điểm hay lộ trình nào. Bấm <strong>+ Đề xuất</strong> để gợi ý nhé!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((place) => {
            const canDel = canDeletePlace(isOwner, myParticipantId, place.participantId);
            const isItinerary = place.type === 'itinerary' && (place.stops?.length ?? 0) > 0;

            return (
              <div
                key={place.id}
                className={`glass-card flex flex-col justify-between gap-3 p-4 ${
                  isItinerary ? 'sm:col-span-2' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {isItinerary && (
                        <span className="mb-1 inline-block rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                          🗺️ Lộ trình {place.stops?.length} chặng
                        </span>
                      )}
                      <h4 className="font-display text-base font-bold">{place.name}</h4>
                    </div>
                    {canDel && (
                      <button
                        type="button"
                        onClick={() => onDeletePlace(place.id)}
                        className="text-xs text-[var(--muted)] hover:text-red-400"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {!isItinerary && place.imageUrl && (
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="h-36 w-full rounded-2xl object-cover"
                    />
                  )}

                  {place.note && (
                    <p className="text-xs text-[var(--muted)]">{place.note}</p>
                  )}

                  {!isItinerary && (
                    <div className="space-y-1">
                      {place.addr && (
                        <p className="text-xs text-[var(--muted)]">📍 {place.addr}</p>
                      )}
                      {place.link && (
                        <a
                          href={place.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-semibold text-[var(--primary)] hover:underline"
                        >
                          Mở trên Google Maps ↗
                        </a>
                      )}
                    </div>
                  )}

                  {isItinerary && place.stops && (
                    <div className="space-y-2.5 pt-1">
                      {place.stops.map((stop, idx) => (
                        <div key={stop.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[11px] font-bold text-[var(--primary)]">
                              {idx + 1}
                            </span>
                            {idx < place.stops!.length - 1 && (
                              <span className="mt-1 w-0.5 flex-1 border-l border-dashed border-[var(--border)]" />
                            )}
                          </div>

                          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3">
                            <div className="flex items-center gap-3">
                              {stop.imageUrl && (
                                <img
                                  src={stop.imageUrl}
                                  alt={stop.name}
                                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                                />
                              )}
                              <div>
                                <p className="text-xs font-bold text-[var(--text)]">
                                  {CAT_ICON[stop.category]}{' '}
                                  {stop.time ? (
                                    <span className="mr-1 font-mono text-[var(--accent)]">
                                      {stop.time}
                                    </span>
                                  ) : null}
                                  {stop.name}
                                </p>
                                {stop.addr && (
                                  <p className="text-[11px] text-[var(--muted)]">{stop.addr}</p>
                                )}
                              </div>
                            </div>

                            {stop.link && (
                              <a
                                href={stop.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] hover:border-[var(--primary)]"
                              >
                                📍 Maps
                              </a>
                            )}
                          </div>
                        </div>
                      ))}

                      <a
                        href={place.link || itineraryMapsUrl(place.stops)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3.5 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary)]/20"
                      >
                        🗺️ Mở toàn bộ lộ trình trên Google Maps ↗
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-xs text-[var(--muted)] tabular-nums">
                    {place.voteCount} lượt thích
                  </span>
                  {canParticipate && (
                    <button
                      type="button"
                      onClick={() => onToggleVote(place.id, !place.votedByMe)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        place.votedByMe
                          ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                          : 'border border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {place.votedByMe ? '✓ Đã chọn' : 'Bình chọn'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddPlaceSheet onClose={() => setShowAdd(false)} onAdd={onAddPlace} />
        )}
      </AnimatePresence>
    </div>
  );
}
