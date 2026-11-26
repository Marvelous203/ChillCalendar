'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { sheetModal } from '@/lib/motion';
import { showCode } from '@/lib/room-code';
import { useToast } from './Toast';

export function ShareRoomButton({
  code,
  title,
  inviteToken,
  isPrivate,
}: {
  code: string;
  title: string;
  inviteToken?: string;
  isPrivate?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = isPrivate && inviteToken ? `/e/${code}?i=${inviteToken}` : `/e/${code}`;
  const fullUrl = `${origin}${path}`;
  const shareText = `Vào chọn giờ rảnh & bình chọn quán cho "${title}" nhé! Mã phòng: ${showCode(code)}`;

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg, 'success');
    } catch {
      toast('Không sao chép được tự động', 'error');
    }
  }

  async function handleMessengerShare() {
    await copy(`${shareText}\n${fullUrl}`, 'Đã sao chép lời mời! Đang mở Messenger...');
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent || '');
    if (isMobile) {
      window.location.href = `fb-messenger://share/?link=${encodeURIComponent(fullUrl)}`;
    } else {
      window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
    }
  }

  async function handleZaloShare() {
    await copy(`${shareText}\n${fullUrl}`, 'Đã sao chép lời mời! Đang mở Zalo...');
    window.open(
      `https://zalo.me/share?url=${encodeURIComponent(fullUrl)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: fullUrl });
        return;
      } catch {
        // Người dùng hủy
      }
    }
    await copy(`${shareText}\n${fullUrl}`, 'Đã sao chép link mời');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/12 px-3.5 py-1.5 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--primary)]/20"
      >
        🔗 Chia sẻ / Link
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              variants={sheetModal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Mời bạn bè vào phòng</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-2 py-1 text-sm text-[var(--muted)]"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs">
                <p className="truncate font-mono text-[var(--primary)]">{fullUrl}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleZaloShare}
                  className="rounded-xl bg-[#0068FF] py-3 text-xs font-bold text-white transition hover:opacity-90"
                >
                  Gửi qua Zalo
                </button>
                <button
                  type="button"
                  onClick={handleMessengerShare}
                  className="rounded-xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] py-3 text-xs font-bold text-white transition hover:opacity-90"
                >
                  Gửi qua Messenger
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => copy(fullUrl, 'Đã sao chép link phòng')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2.5 text-xs font-semibold hover:border-[var(--primary)]"
                >
                  📋 Sao chép link
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2.5 text-xs font-semibold hover:border-[var(--primary)]"
                >
                  📤 Chia sẻ nhanh
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
