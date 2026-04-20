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
          background:
            'radial-gradient(ellipse at 30% 30%, #d62828 0%, #1a1a1d 70%, #0a0a0b 100%)',
          borderRadius: 40,
          fontSize: 110,
        }}
      >
        🥊
      </div>
    ),
    size,
  );
}
