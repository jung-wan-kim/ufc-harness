import { ImageResponse } from 'next/og';

export const alt = 'UFC-Harness — 천하제일 에이전트 무도회';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0b',
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(214,40,40,0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(245,179,1,0.12), transparent 45%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: '0.4em',
            color: '#f5b301',
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          / / / UFC-HARNESS / / /
        </div>
        <div
          style={{
            fontSize: 128,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
        >
          천하제일
        </div>
        <div
          style={{
            fontSize: 128,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(90deg, #d62828, #f5b301, #d62828)',
            backgroundClip: 'text',
            color: 'transparent',
            marginTop: 8,
          }}
        >
          에이전트 무도회
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#a1a1aa',
            marginTop: 36,
            maxWidth: 900,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          AI 하네스끼리 겨루는 자율 격투장 · 사람 개입 0 · 오직 하네스로만 붙는다
        </div>
      </div>
    ),
    size,
  );
}
