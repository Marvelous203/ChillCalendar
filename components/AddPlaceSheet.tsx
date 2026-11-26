'use client';

import { useState } from 'react';
import { motion, Reorder, useDragControls } from 'motion/react';
import { compressImageToWebp } from '@/lib/image-compress';
import { extractCoordsFromMapsUrl, searchMapsUrl, validateGoogleMapsUrl } from '@/lib/maps';
import { sheetModal } from '@/lib/motion';
import type { ItineraryStop, PlaceCategory, PlaceType, PublicPlace } from '@/lib/types';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

const CATEGORY_META: Array<{
  id: PlaceCategory;
  icon: string;
  label: string;
  badgeClass: string;
}> = [
    { id: 'checkin', icon: '📸', label: 'Check-in', badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
    { id: 'food', icon: '🍜', label: 'Ăn uống', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    { id: 'cafe', icon: '☕', label: 'Cà phê', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    { id: 'play', icon: '🎤', label: 'Giải trí', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-400/30' },
  ];

async function uploadCompressedImage(file: File): Promise<string> {
  const webp = await compressImageToWebp(file);
  const fd = new FormData();
  fd.append('file', webp, 'place.webp');
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'Upload ảnh thất bại');
  }
  return json.url;
}

async function fetchMapsPreviewImage(url: string): Promise<string> {
  const res = await fetch('/api/maps/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as { imageUrl?: string };
  return json.imageUrl ?? '';
}

function StopRow({
  stop,
  index,
  onUpdate,
  onRemove,
  onError,
}: {
  stop: ItineraryStop;
  index: number;
  onUpdate: (patch: Partial<ItineraryStop>) => void;
  onRemove: () => void;
  onError: (msg: string) => void;
}) {
  const dragControls = useDragControls();
  const [uploading, setUploading] = useState(false);
  const meta = CATEGORY_META.find((c) => c.id === stop.category) ?? CATEGORY_META[0];

  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={dragControls}
      className="relative flex gap-2.5 pl-2"
    >
      {/* Đường nối dọc + số thứ tự */}
      <div className="flex flex-col items-center pt-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-fg)]">
          {index + 1}
        </span>
        <span className="mt-1 w-0.5 flex-1 border-l border-dashed border-[var(--border)]" />
      </div>

      <div className="mb-3 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
              title="Kéo để đổi thứ tự"
              className="cursor-grab rounded-lg border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)] active:cursor-grabbing"
            >
              ⋮⋮
            </button>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}>
              {meta.icon} {meta.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              value={stop.time ?? ''}
              onChange={(e) => onUpdate({ time: e.target.value })}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] px-2 py-1 text-[11px] tabular-nums"
            />
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-[var(--muted)] hover:text-red-400"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <PlaceAutocompleteInput
            value={stop.name}
            onChange={(name) => onUpdate({ name })}
            onSelectSuggestion={(s) =>
              onUpdate({
                name: s.name,
                addr: s.addr,
                link: s.link,
                lat: s.lat,
                lng: s.lng,
              })
            }
            placeholder={`Tên địa điểm ${meta.label.toLowerCase()}...`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={
                stop.name.trim()
                  ? searchMapsUrl(`${stop.name} ${stop.addr}`.trim(), stop.lat, stop.lng)
                  : 'https://www.google.com/maps'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]"
            >
              🗺️ Mở GG Maps ↗
            </a>
            <input
              type="url"
              maxLength={300}
              value={stop.link}
              onChange={(e) => {
                const nextLink = e.target.value;
                const coords = extractCoordsFromMapsUrl(nextLink);
                onUpdate({
                  link: nextLink,
                  ...(coords ? { lat: coords.lat, lng: coords.lng } : { lat: undefined, lng: undefined }),
                });
              }}
              placeholder="Dán link GG Maps..."
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              maxLength={160}
              value={stop.addr}
              onChange={(e) => onUpdate({ addr: e.target.value })}
              placeholder="Địa chỉ (tự điền khi chọn gợi ý)"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
            />
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-center text-[11px] font-semibold text-[var(--muted)] hover:border-[var(--primary)]">
                {uploading ? 'Đang nén...' : stop.imageUrl ? '✓ Đã có ảnh (Đổi)' : '📷 Thêm ảnh'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const url = await uploadCompressedImage(file);
                      onUpdate({ imageUrl: url });
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Lỗi tải ảnh');
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export function AddPlaceSheet({
  initialPlace,
  onClose,
  onSave,
}: {
  initialPlace?: PublicPlace | null;
  onClose: () => void;
  onSave: (payload: {
    type: PlaceType;
    name: string;
    addr: string;
    link: string;
    imageUrl: string;
    note: string;
    stops: ItineraryStop[];
  }) => Promise<void>;
}) {
  const isEditing = Boolean(initialPlace);
  const [mode, setMode] = useState<PlaceType>(initialPlace?.type ?? 'single');
  const [name, setName] = useState(initialPlace?.name ?? '');
  const [addr, setAddr] = useState(initialPlace?.addr ?? '');
  const [link, setLink] = useState(initialPlace?.link ?? '');
  const [imageUrl, setImageUrl] = useState(initialPlace?.imageUrl ?? '');
  const [note, setNote] = useState(initialPlace?.note ?? '');
  const [uploading, setUploading] = useState(false);

  const [stops, setStops] = useState<ItineraryStop[]>(
    initialPlace?.stops && initialPlace.stops.length > 0
      ? initialPlace.stops
      : [
          { id: 'stop-1', category: 'checkin', time: '16:30', name: '', addr: '', link: '' },
          { id: 'stop-2', category: 'food', time: '18:30', name: '', addr: '', link: '' },
        ]
  );

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function addStop(category: PlaceCategory) {
    if (stops.length >= 8) {
      setError('Lộ trình tối đa 8 chặng');
      return;
    }
    setStops((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        time: '',
        name: '',
        addr: '',
        link: '',
      },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'single') {
      if (!name.trim()) {
        setError('Vui lòng nhập tên quán hoặc địa điểm');
        return;
      }
      if (link.trim() && validateGoogleMapsUrl(link) === null) {
        setError('Chỉ chấp nhận link Google Maps');
        return;
      }
      setSubmitting(true);
      try {
        await onSave({
          type: 'single',
          name: name.trim(),
          addr: addr.trim(),
          link: link.trim() || searchMapsUrl(`${name} ${addr}`.trim()),
          imageUrl: imageUrl.trim(),
          note: note.trim(),
          stops: [],
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không lưu được địa điểm');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const validStops = stops.filter((s) => s.name.trim().length > 0);
    if (validStops.length === 0) {
      setError('Hãy nhập ít nhất 1 chặng trong lộ trình');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        type: 'itinerary',
        name: name.trim() || `Lộ trình ${validStops.length} chặng`,
        addr: '',
        link: '',
        imageUrl: imageUrl.trim(),
        note: note.trim(),
        stops: validStops.map((s) => ({
          ...s,
          name: s.name.trim(),
          addr: s.addr.trim(),
          link: s.link.trim() || searchMapsUrl(`${s.name} ${s.addr}`.trim(), s.lat, s.lng),
        })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được lộ trình');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        variants={sheetModal}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {isEditing ? 'Chỉnh sửa địa điểm / lộ trình' : 'Đề xuất địa điểm / lộ trình'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)]"
          >
            ✕
          </button>
        </div>

        {/* Segmented control: Địa điểm lẻ vs Theo lộ trình */}
        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-[var(--bg)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setError('');
            }}
            className={`rounded-xl py-2 text-xs font-bold transition ${mode === 'single'
              ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
              : 'text-[var(--muted)]'
              }`}
          >
            📍 1 Địa điểm lẻ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('itinerary');
              setError('');
            }}
            className={`rounded-xl py-2 text-xs font-bold transition ${mode === 'itinerary'
              ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
              : 'text-[var(--muted)]'
              }`}
          >
            🗺️ Theo lộ trình (Kéo-thả)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {mode === 'single' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Tên quán / địa điểm (gõ để hiện gợi ý địa chỉ) *
                </label>
                <PlaceAutocompleteInput
                  value={name}
                  onChange={setName}
                  onSelectSuggestion={(s) => {
                    setName(s.name);
                    setAddr(s.addr);
                    setLink(s.link);
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Địa chỉ chi tiết
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="Tự động điền khi chọn gợi ý hoặc tự nhập"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Link Google Maps (tự tạo nếu để trống)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={
                        name.trim()
                          ? searchMapsUrl(`${name} ${addr}`.trim())
                          : 'https://www.google.com/maps'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20"
                    >
                      🗺️ Mở Google Maps ↗
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = (await navigator.clipboard.readText()).trim();
                          if (text) {
                            setLink(text);
                            if (!imageUrl && validateGoogleMapsUrl(text)) {
                              const img = await fetchMapsPreviewImage(text);
                              if (img) setImageUrl(img);
                            }
                          }
                        } catch {
                          setError('Trình duyệt chặn đọc clipboard, hãy dán bằng Ctrl+V');
                        }
                      }}
                      className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      📋 Dán
                    </button>
                  </div>
                </div>
                <input
                  type="url"
                  maxLength={300}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Dán link chia sẻ từ Google Maps (https://maps.app.goo.gl/...)"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                    Ảnh minh họa (Từ GG Maps, URL hoặc máy)
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... hoặc lấy từ GG Maps"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="button"
                    disabled={uploading || !link.trim()}
                    onClick={async () => {
                      if (!validateGoogleMapsUrl(link)) {
                        setError('Hãy dán link Google Maps hợp lệ trước');
                        return;
                      }
                      setUploading(true);
                      try {
                        const img = await fetchMapsPreviewImage(link);
                        if (img) {
                          setImageUrl(img);
                        } else {
                          setError('Link Google Maps này không có ảnh công khai — bạn hãy dán URL ảnh hoặc chọn từ máy.');
                        }
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="flex-1 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2.5 py-2 text-center text-[11px] font-semibold text-[var(--primary)] disabled:opacity-45"
                  >
                    {uploading ? 'Đang lấy...' : '🖼️ Lấy từ GG Maps'}
                  </button>
                  <label className="cursor-pointer rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-center text-[11px] font-semibold text-[var(--muted)] hover:border-[var(--primary)]">
                    📷 Từ máy
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const url = await uploadCompressedImage(file);
                          setImageUrl(url);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Lỗi upload ảnh');
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Ghi chú ngắn (giá, chỗ đậu xe...)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vd: Có chỗ đậu xe máy miễn phí, view đẹp"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên lộ trình (vd: Kèo chiều cuối tuần)"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <input
                  type="text"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú chung (tùy chọn)"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Khay thẻ chặng (Block Palette) */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted)]">
                  Chạm để thêm chặng vào lộ trình ({stops.length}/8):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_META.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => addStop(cat.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-85 ${cat.badgeClass}`}
                    >
                      + {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline Canvas kéo-thả */}
              <Reorder.Group
                axis="y"
                values={stops}
                onReorder={setStops}
                className="pt-1"
              >
                {stops.map((stop, idx) => (
                  <StopRow
                    key={stop.id}
                    stop={stop}
                    index={idx}
                    onError={setError}
                    onUpdate={(patch) =>
                      setStops((prev) =>
                        prev.map((item) =>
                          item.id === stop.id ? { ...item, ...patch } : item
                        )
                      )
                    }
                    onRemove={() =>
                      setStops((prev) => prev.filter((item) => item.id !== stop.id))
                    }
                  />
                ))}
              </Reorder.Group>
            </>
          )}

          {error && <p className="text-xs font-medium text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] disabled:opacity-60"
          >
            {submitting
              ? 'Đang lưu...'
              : isEditing
                ? 'Lưu thay đổi'
                : mode === 'itinerary'
                  ? 'Đề xuất lộ trình này'
                  : 'Thêm địa điểm'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
