'use client';

import { motion } from 'motion/react';
import { useAppTheme } from '@/lib/themes';

export function Background() {
  const [theme] = useAppTheme();

  if (theme === 't1') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#080305]"
      >
        {/* Nền T1 đỏ phủ toàn màn hình với hiệu ứng blur dịu mắt */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/themes/t1-bg.jpg"
          alt=""
          className="h-full w-full scale-110 object-cover opacity-55 blur-md"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#140408]/65 to-black/85" />

        {/* Điểm sáng đỏ T1 di chuyển nhẹ */}
        <motion.div
          animate={{ x: [0, 24, -12, 0], y: [0, -16, 12, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #E4002B, transparent 70%)' }}
        />
        <motion.div
          animate={{ x: [0, -20, 16, 0], y: [0, 20, -14, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FF3B5C, transparent 70%)' }}
        />

        {/* Ảnh trang trí 2 bên tách biệt hoàn toàn khỏi luồng bố cục (chỉ hiện màn hình rộng >= 1280px) */}
        <div className="hidden xl:block">
          {/* Bên trái: căn giữa theo chiều dọc & kích thước lớn hơn */}
          <div className="absolute right-[calc(50%+528px)] top-1/2 -translate-y-1/2">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-56 opacity-95 drop-shadow-2xl 2xl:w-64"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/themes/t1-left.png"
                alt=""
                className="h-auto w-full select-none object-contain"
              />
            </motion.div>
          </div>

          {/* Bên phải: căn giữa theo chiều dọc & kích thước lớn hơn */}
          <div
            className="absolute left-[calc(50%+528px)] top-1/2 w-100 -translate-y-1/2 overflow-hidden rounded-3xl opacity-85 shadow-2xl 4xl:w-80"
            style={{
              maskImage: 'linear-gradient(to top, transparent 0%, black 16%, black 86%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to top, transparent 0%, black 16%, black 86%, transparent 100%)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/themes/rightside.jpg"
              alt=""
              className="h-180 w-full select-none rounded-3xl object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <motion.div
        animate={{ x: [0, 30, -15, 0], y: [0, -20, 15, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }}
      />
      <motion.div
        animate={{ x: [0, -25, 20, 0], y: [0, 25, -15, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
      />
    </div>
  );
}
