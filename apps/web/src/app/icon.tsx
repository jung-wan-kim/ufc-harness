import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 35% 35%, #d62828 0%, #0a0a0b 80%)',
          borderRadius: 6,
          fontSize: 20,
          fontWeight: 900,
          color: '#f5b301',
          letterSpacing: '-0.05em',
        }}
      >
        🥊
      </div>
    ),
    size,
  );
}
