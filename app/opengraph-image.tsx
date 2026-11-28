import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: '#3DD0C6',
              color: '#072022',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            -.-
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#3DD0C6' }}>
            Chill With Me
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.15 }}>
            Bạn đi đâu tôi đi đấy
          </div>
          <div style={{ fontSize: 30, color: '#B4CBD1', lineHeight: 1.35 }}>
            Không đi cùng nhau những ngày mưa thì đừng tìm nhau những ngày nắng
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 24, fontWeight: 600, color: '#FF9E78' }}>
          <span>Hẹn giờ rảnh • Đề xuất quán • Live Check-in & Album kỷ niệm</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
