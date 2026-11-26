'use client';

import { useState } from 'react';
import { showCode } from '@/lib/room-code';
import { useToast } from './Toast';

export function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(showCode(code));
      setCopied(true);
      toast(`Đã sao chép mã ${showCode(code)}`, 'success');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Không thể sao chép mã', 'error');
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Bấm để sao chép mã phòng"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1 font-mono text-xs font-bold tracking-wider text-[var(--primary)] transition hover:bg-[var(--primary)]/20"
    >
      <span>{showCode(code)}</span>
      <span className="text-[10px] opacity-80">{copied ? '✓' : '📋'}</span>
    </button>
  );
}
