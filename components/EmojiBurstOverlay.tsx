'use client';

import type { CSSProperties } from 'react';
import type { ReactionEmoji } from '@/lib/types';

export interface FloatingEmojiItem {
  id: string;
  momentId: string;
  emoji: ReactionEmoji;
  xPct: number;
  yPct: number;
  swayAmp: number;
  floatDur: number;
  swayDur: number;
  tilt: number;
  scale: number;
  delayMs: number;
}

export function createFloatingEmoji(
  momentId: string,
  emoji: ReactionEmoji,
  xPct?: number,
  yPct?: number
): FloatingEmojiItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    momentId,
    emoji,
    xPct: xPct ?? 35 + Math.random() * 45,
    yPct: yPct ?? 65 + Math.random() * 20,
    swayAmp: Math.round(8 + Math.random() * 12),
    floatDur: Number((2.05 + Math.random() * 0.85).toFixed(2)),
    swayDur: Number((1.1 + Math.random() * 0.6).toFixed(2)),
    tilt: Math.round(5 + Math.random() * 9) * (Math.random() > 0.5 ? 1 : -1),
    scale: Number((0.92 + Math.random() * 0.34).toFixed(2)),
    delayMs: Math.round(Math.random() * 70),
  };
}

export function EmojiBurstOverlay({
  items,
  onDone,
}: {
  items: FloatingEmojiItem[];
  onDone: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {items.map((item) => {
        const outerStyle = {
          left: `${item.xPct}%`,
          top: `${item.yPct}%`,
          '--float-dur': `${item.floatDur}s`,
          animationDelay: `${item.delayMs}ms`,
        } as CSSProperties;
        const innerStyle = {
          '--sway-amp': `${item.swayAmp}px`,
          '--sway-dur': `${item.swayDur}s`,
          '--tilt': `${item.tilt}deg`,
          fontSize: `${Math.round(24 * item.scale)}px`,
        } as CSSProperties;

        return (
          <div
            key={item.id}
            style={outerStyle}
            onAnimationEnd={() => onDone(item.id)}
            className="cwm-float-outer absolute -translate-x-1/2 -translate-y-1/2 select-none"
          >
            <span style={innerStyle} className="cwm-float-inner inline-block drop-shadow-md">
              {item.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
}
