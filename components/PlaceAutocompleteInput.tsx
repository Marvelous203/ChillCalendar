'use client';

import { useEffect, useRef, useState } from 'react';
import { searchMapsUrl } from '@/lib/maps';

interface PhotonFeature {
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface AutocompleteSuggestion {
  name: string;
  addr: string;
  link: string;
}

function formatPhotonFeature(f: PhotonFeature): AutocompleteSuggestion | null {
  const p = f.properties;
  if (!p) return null;
  const streetPart = [p.housenumber, p.street].filter(Boolean).join(' ');
  const name = (p.name || streetPart || '').trim();
  if (!name) return null;
  const addrParts = [
    p.name && streetPart ? streetPart : '',
    p.district || p.suburb || '',
    p.city || p.state || '',
  ].filter(Boolean);
  const addr = Array.from(new Set(addrParts)).join(', ').slice(0, 160);
  const link = searchMapsUrl(`${name} ${addr}`.trim());
  return { name: name.slice(0, 80), addr, link };
}

export function PlaceAutocompleteInput({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = 'Gõ tên quán hoặc địa chỉ (vd: Phúc Long Lê Văn Sỹ)...',
}: {
  value: string;
  onChange: (next: string) => void;
  onSelectSuggestion: (s: AutocompleteSuggestion) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipNextFetchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  useEffect(() => {
    const q = value.trim();
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (q.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=10.7769&lon=106.7009&limit=5`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { features?: PhotonFeature[] };
        const list = (json.features ?? [])
          .map(formatPhotonFeature)
          .filter((x): x is AutocompleteSuggestion => x !== null);
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        // Bỏ qua khi abort hoặc offline
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  return (
    <div
      ref={containerRef}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      className="relative"
    >
      <input
        type="text"
        maxLength={80}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next.trim().length < 2) {
            setSuggestions([]);
            setOpen(false);
          }
          onChange(next);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 pr-9 text-sm outline-none focus:border-[var(--primary)]"
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--muted)]">
          ...
        </span>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-1.5 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-[var(--muted)]">
            <span>Gợi ý địa chỉ</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-0.5 hover:bg-[var(--bg)] hover:text-[var(--text)]"
            >
              Đóng ✕
            </button>
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={`${item.name}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                skipNextFetchRef.current = true;
                setOpen(false);
                onSelectSuggestion(item);
              }}
              className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--primary)]/12"
            >
              <p className="text-xs font-bold text-[var(--text)]">{item.name}</p>
              {item.addr && (
                <p className="truncate text-[11px] text-[var(--muted)]">{item.addr}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
