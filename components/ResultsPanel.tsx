'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatDateVi, hoursRange, makeSlotKey } from '@/lib/dates';
import { computeHeatmapAndTop3 } from '@/lib/suggest';
import { formatHour } from '@/lib/timezone';
import type { PublicParticipant, PublicPlace } from '@/lib/types';
import { UserAvatar } from './UserAvatar';

export function ResultsPanel({
  dates,
  hourFrom,
  hourTo,
  participants,
  responses,
  places,
  canFinalize,
  onFinalize,
}: {
  dates: string[];
  hourFrom: number;
  hourTo: number;
  participants: PublicParticipant[];
  responses: Array<{ participantId: string; slots: string[] }>;
  places: PublicPlace[];
  canFinalize: boolean;
  onFinalize: (payload: {
    date: string;
    from: number;
    to: number;
    placeId: string | null;
  }) => Promise<void>;
}) {
  const hours = hoursRange(hourFrom, hourTo);
  const heatmap = useMemo(
    () => computeHeatmapAndTop3(dates, hourFrom, hourTo, participants, responses),
    [dates, hourFrom, hourTo, participants, responses]
  );

  const [inspected, setInspected] = useState<{ date: string; hour: number } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    date: string;
    from: number;
    to: number;
  } | null>(null);
  const [chosenPlaceId, setChosenPlaceId] = useState<string>('');
  const [finalizing, setFinalizing] = useState(false);

  const approved = participants.filter((p) => p.status === 'approved');
  const participantMap = new Map(approved.map((p) => [p.id, p]));
  const respondedIds = useMemo(
    () => new Set(responses.filter((r) => r.slots.length > 0).map((r) => r.participantId)),
    [responses]
  );

  const inspectedKey = inspected ? makeSlotKey(inspected.date, inspected.hour) : null;
  const inspectedAvailIds = new Set(inspectedKey ? heatmap.counts[inspectedKey] ?? [] : []);
  const inspectedAvail = approved.filter((p) => inspectedAvailIds.has(p.id));
  const inspectedBusy = approved.filter(
    (p) => respondedIds.has(p.id) && !inspectedAvailIds.has(p.id)
  );
  const inspectedPending = approved.filter((p) => !respondedIds.has(p.id));

  function openFinalizeFor(date: string, from: number, to: number) {
    const topPlace = [...places].sort((a, b) => b.voteCount - a.voteCount)[0];
    setChosenPlaceId(topPlace?.id ?? '');
    setConfirmTarget({ date, from, to });
  }

  function renderInspectorBody(slot: { date: string; hour: number }) {
    return (
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm font-bold tabular-nums">
              {formatDateVi(slot.date).full}
            </p>
            <p className="text-xs font-semibold text-[var(--primary)] tabular-nums">
              {formatHour(slot.hour)} – {formatHour(slot.hour + 1)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {canFinalize && (
              <button
                type="button"
                onClick={() => openFinalizeFor(slot.date, slot.hour, slot.hour + 1)}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent-fg)]"
              >
                Chốt giờ này
              </button>
            )}
            <button
              type="button"
              onClick={() => setInspected(null)}
              aria-label="Đóng chi tiết ô"
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--primary)]">
              ✓ Rảnh ({inspectedAvail.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inspectedAvail.length === 0 ? (
                <span className="text-xs text-[var(--muted)]">Chưa có ai</span>
              ) : (
                inspectedAvail.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] py-0.5 pl-1 pr-2.5 text-xs font-medium"
                  >
                    <UserAvatar name={p.name} size="sm" />
                    {participantMap.get(p.id)?.name ?? p.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
              ✕ Bận ({inspectedBusy.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inspectedBusy.length === 0 ? (
                <span className="text-xs text-[var(--muted)]">Không ai bận!</span>
              ) : (
                inspectedBusy.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] py-0.5 pl-1 pr-2.5 text-xs text-[var(--muted)] line-through opacity-75"
                  >
                    <UserAvatar name={p.name} size="sm" muted />
                    {p.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {inspectedPending.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
                ◌ Chưa chọn ({inspectedPending.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {inspectedPending.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] bg-[var(--bg)]/60 py-0.5 pl-1 pr-2.5 text-xs text-[var(--muted)]"
                  >
                    <UserAvatar name={p.name} size="sm" muted />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function confirmFinalize() {
    if (!confirmTarget) return;
    setFinalizing(true);
    try {
      await onFinalize({
        date: confirmTarget.date,
        from: confirmTarget.from,
        to: confirmTarget.to,
        placeId: chosenPlaceId || null,
      });
      setConfirmTarget(null);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Top 3 khung giờ tốt nhất */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Top gợi ý giờ rảnh</h3>
          <span className="text-xs text-[var(--muted)] tabular-nums">
            {approved.length} người tham gia
          </span>
        </div>

        {heatmap.top3.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            Chưa có ai chọn giờ rảnh. Hãy qua tab Giờ rảnh để điền trước nhé!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {heatmap.top3.map((slot, idx) => (
              <motion.div
                key={`${slot.date}-${slot.from}-${slot.to}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3.5"
              >
                <div>
                  <span className="inline-block rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    Top #{idx + 1} • {slot.score}/{approved.length} rảnh
                  </span>
                  <p className="mt-2 font-display text-sm font-bold">
                    {formatDateVi(slot.date).full}
                  </p>
                  <p className="text-xs font-semibold text-[var(--primary)] tabular-nums">
                    {formatHour(slot.from)} – {formatHour(slot.to)}
                  </p>
                </div>

                {canFinalize && (
                  <button
                    type="button"
                    onClick={() => {
                      const topPlace = [...places].sort((a, b) => b.voteCount - a.voteCount)[0];
                      setChosenPlaceId(topPlace?.id ?? '');
                      setConfirmTarget({ date: slot.date, from: slot.from, to: slot.to });
                    }}
                    className="w-full rounded-xl bg-[var(--accent)] py-2 text-xs font-bold text-[var(--accent-fg)] transition hover:opacity-90"
                  >
                    Chốt khung này
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lưới nhiệt (Heatmap) */}
      <div className="glass-card p-3 sm:p-5">
        <p className="mb-3 text-xs text-[var(--muted)]">
          Chạm vào một ô bất kỳ để xem chi tiết{' '}
          <strong className="text-[var(--text)]">Ai rảnh / Ai bận / Chưa chọn</strong>.
        </p>

        <div className="overflow-x-auto pb-2">
          <div
            className="inline-grid gap-1.5"
            style={{
              gridTemplateColumns: `64px repeat(${dates.length}, minmax(96px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10 bg-[var(--surface-solid)]" />
            {dates.map((date) => {
              const info = formatDateVi(date);
              return (
                <div key={date} className="pb-1 text-center">
                  <p className="text-xs font-bold">{info.weekday}</p>
                  <p className="text-[11px] text-[var(--muted)] tabular-nums">{info.short}</p>
                </div>
              );
            })}

            {hours.map((h) => (
              <div key={`hm-row-${h}`} className="contents">
                <div className="sticky left-0 z-10 flex items-center justify-end bg-[var(--surface-solid)] pr-2 text-[11px] font-medium text-[var(--muted)] tabular-nums">
                  {formatHour(h)}
                </div>
                {dates.map((date) => {
                  const key = makeSlotKey(date, h);
                  const availIds = heatmap.counts[key] ?? [];
                  const availPeople = availIds
                    .map((id) => participantMap.get(id))
                    .filter((p): p is PublicParticipant => Boolean(p));
                  const count = availPeople.length;
                  const ratio =
                    heatmap.totalApproved > 0 ? count / heatmap.totalApproved : 0;
                  const isInspected =
                    inspected?.date === date && inspected?.hour === h;

                  return (
                    <button
                      key={key}
                      type="button"
                      title={
                        count > 0
                          ? `${formatHour(h)} • ${count} rảnh: ${availPeople.map((p) => p.name).join(', ')}`
                          : `${formatHour(h)} • Chưa có ai rảnh`
                      }
                      onClick={() =>
                        setInspected(isInspected ? null : { date, hour: h })
                      }
                      style={{ '--p': ratio } as React.CSSProperties}
                      className={`heatmap-cell flex h-9 items-center justify-center gap-1 rounded-lg border px-1.5 text-xs font-bold tabular-nums transition ${
                        isInspected
                          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                          : 'border-[var(--border)]'
                      } ${ratio > 0.55 ? 'text-white' : 'text-[var(--text)]'}`}
                    >
                      {count > 0 && (
                        <>
                          <span className="flex items-center -space-x-1.5">
                            {availPeople.slice(0, 2).map((p) => (
                              <UserAvatar
                                key={p.id}
                                name={p.name}
                                size="xs"
                                className="ring-1 ring-[var(--surface-solid)]"
                              />
                            ))}
                          </span>
                          {count > 2 && (
                            <span className="text-[10px] font-bold">+{count - 2}</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Máy tính: Khung chi tiết nổi ở khoảng trống bên phải, không ép hẹp lưới */}
      <AnimatePresence>
        {inspected && (
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
            className="fixed right-5 top-24 z-40 hidden max-h-[calc(100vh-7rem)] w-80 overflow-y-auto rounded-2xl border border-[var(--accent)]/45 bg-[var(--surface-solid)]/95 p-4 shadow-2xl backdrop-blur-md lg:block"
          >
            {renderInspectorBody(inspected)}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Điện thoại: Bảng trượt từ dưới lên (Bottom Sheet) */}
      <AnimatePresence>
        {inspected && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label="Đóng chi tiết khung giờ"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspected(null)}
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface-solid)] px-5 pb-6 pt-3 shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
              {renderInspectorBody(inspected)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hộp thoại xác nhận chốt lịch */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">
              Nhóm đã thống nhất lựa chọn này chưa?
            </h3>
            <p className="text-sm text-[var(--muted)] tabular-nums">
              {formatDateVi(confirmTarget.date).full} • {formatHour(confirmTarget.from)} –{' '}
              {formatHour(confirmTarget.to)}
            </p>

            {places.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                  Chọn quán đi kèm (tùy chọn)
                </label>
                <select
                  value={chosenPlaceId}
                  onChange={(e) => setChosenPlaceId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
                >
                  <option value="">-- Chưa chọn quán cụ thể --</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.voteCount} bình chọn)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={finalizing}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={confirmFinalize}
                disabled={finalizing}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[var(--accent-fg)] disabled:opacity-60"
              >
                {finalizing ? 'Đang chốt...' : 'Xác nhận chốt lịch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
