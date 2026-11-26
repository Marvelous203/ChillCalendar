'use client';

import { useState, useSyncExternalStore } from 'react';
import { useToast } from './Toast';

const subscribeNoop = () => () => {};

export function WebViewBanner() {
  const isWebView = useSyncExternalStore(
    subscribeNoop,
    () => /Zalo|FBAN|FBAV|Messenger/i.test(navigator.userAgent || ''),
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  if (!isWebView || dismissed) return null;

  async function copyCurrentUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Đã sao chép link, hãy dán vào Safari hoặc Chrome', 'success');
    } catch {
      toast('Không sao chép được tự động, hãy copy từ thanh địa chỉ', 'error');
    }
  }

  return (
    <div className="border-b border-[var(--accent)]/30 bg-[var(--accent)]/12 px-4 py-2.5 text-xs sm:text-sm">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[var(--text)]">
          Bạn đang mở từ Zalo/Messenger. Hãy mở bằng Safari/Chrome để không bị mất lịch đã chọn.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyCurrentUrl}
            className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]"
          >
            Sao chép link
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Đóng thông báo"
            className="rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
