'use client';

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { canDeletePlace } from '@/lib/permissions';
import type { PublicPlace } from '@/lib/types';
import { AddPlaceSheet } from './AddPlaceSheet';

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
  onAddPlace: (payload: { name: string; addr: string; link: string }) => Promise<void>;
  onDeletePlace: (placeId: string) => Promise<void>;
  onToggleVote: (placeId: string, nextOn: boolean) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const sorted = [...places].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="font-display text-base font-bold">Đề xuất & Bình chọn quán</h3>
          <p className="text-xs text-[var(--muted)]">
            Dán link Google Maps để mọi người xem đường đi và bình chọn.
          </p>
        </div>
        {canParticipate && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90"
          >
            + Đề xuất quán
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-[var(--muted)]">
          Chưa có quán nào được đề xuất. Hãy là người đầu tiên gợi ý nhé!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((place) => {
            const canDel = canDeletePlace(isOwner, myParticipantId, place.participantId);
            return (
              <div
                key={place.id}
                className="glass-card flex flex-col justify-between gap-3 p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-display text-base font-bold">{place.name}</h4>
                    {canDel && (
                      <button
                        type="button"
                        onClick={() => onDeletePlace(place.id)}
                        className="text-xs text-[var(--muted)] hover:text-red-500"
                        title="Xóa địa điểm"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                  {place.addr && <p className="text-xs text-[var(--muted)]">{place.addr}</p>}
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
