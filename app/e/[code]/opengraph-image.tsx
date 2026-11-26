import { ImageResponse } from 'next/og';
import { normalizeCode, showCode } from '@/lib/room-code';
import { getStore } from '@/lib/store';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cleanCode = normalizeCode(code);
  const ev = await getStore().getEventByCode(cleanCode);

  const isPrivate = ev?.visibility === 'private';
  const title = !ev
    ? 'Hẹn Giờ Rảnh'
    : isPrivate
      ? 'Phòng riêng tư • Hẹn Giờ Rảnh'
      : ev.title;
  const subtitle = !ev
    ? 'Chọn giờ rảnh & bình chọn quán cùng bạn bè'
    : isPrivate
      ? 'Bấm để mở hoặc xin vào phòng'
      : `${ev.dates.length} ngày dự kiến • Bấm để chọn giờ rảnh`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #0B1419 0%, #0F2B30 55%, #0FA3A3 100%)',
          color: '#EEF5F7',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3DD0C6' }}>
            Hẹn Giờ Rảnh
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              padding: '10px 26px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              border: '2px solid rgba(61,208,198,0.5)',
              letterSpacing: 4,
            }}
          >
            {showCode(cleanCode)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.15 }}>
            {title}
          </div>
          <div style={{ fontSize: 30, color: '#B4CBD1' }}>{subtitle}</div>
        </div>

        <div style={{ fontSize: 24, color: '#FF9E78', fontWeight: 600 }}>
          Không cần tài khoản • Múi giờ Việt Nam (UTC+7)
        </div>
      </div>
    ),
    { ...size }
  );
}
