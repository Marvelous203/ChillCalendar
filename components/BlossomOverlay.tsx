'use client';

import { useEffect, useRef } from 'react';
import { useBlossomEffect } from '@/lib/themes';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rot: number;
  rotSpeed: number;
  flip: number;
  flipSpeed: number;
  alpha: number;
  color: string;
}

const PETAL_COLORS = ['#ff8fab', '#ffb3c6', '#ffc2d1', '#ff9ebb', '#ffd6e0'];

function createPetal(width: number, height: number, randomY: boolean): Petal {
  return {
    x: Math.random() * width,
    y: randomY ? Math.random() * height : -20 - Math.random() * 60,
    size: 5.5 + Math.random() * 6.5,
    speedY: 0.65 + Math.random() * 0.95,
    speedX: -0.25 + Math.random() * 0.5,
    swayAmp: 0.35 + Math.random() * 0.65,
    swayFreq: 0.012 + Math.random() * 0.016,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.028,
    flip: Math.random() * Math.PI * 2,
    flipSpeed: 0.02 + Math.random() * 0.03,
    alpha: 0.45 + Math.random() * 0.42,
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(1, 0.55 + 0.45 * Math.cos(p.flip));
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;

  // Vẽ cánh hoa đào khuyết nhẹ ở đầu cánh
  const s = p.size;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.9, -s * 0.75, -s * 0.18, -s * 0.85);
  ctx.lineTo(0, -s * 0.58);
  ctx.lineTo(s * 0.18, -s * 0.85);
  ctx.bezierCurveTo(s * 0.9, -s * 0.75, s * 0.95, s * 0.35, 0, s * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function BlossomOverlay({
  count = 26,
  enabled: enabledProp,
}: {
  count?: number;
  enabled?: boolean;
}) {
  const [savedEnabled] = useBlossomEffect();
  const enabled = enabledProp ?? savedEnabled;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    const actualCount = width < 640 ? Math.min(count, 16) : count;
    const petals: Petal[] = Array.from({ length: actualCount }, () =>
      createPetal(width, height, true)
    );

    let rafId = 0;
    let tick = 0;

    function frame() {
      if (!ctx) return;
      if (document.visibilityState === 'visible') {
        tick += 1;
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < petals.length; i++) {
          const p = petals[i];
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(tick * p.swayFreq + p.phase) * p.swayAmp;
          p.rot += p.rotSpeed;
          p.flip += p.flipSpeed;

          if (p.y > height + 24 || p.x < -30 || p.x > width + 30) {
            petals[i] = createPetal(width, height, false);
          } else {
            drawPetal(ctx, p);
          }
        }
      }
      rafId = window.requestAnimationFrame(frame);
    }

    rafId = window.requestAnimationFrame(frame);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [enabled, count]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20"
    />
  );
}
