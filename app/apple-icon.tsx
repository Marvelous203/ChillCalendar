import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3DD0C6',
          color: '#072022',
          borderRadius: 36,
          fontSize: 78,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        -.-
      </div>
    ),
    { ...size }
  );
}
