import { ImageResponse } from 'next/og';

export const alt = 'UFC-Harness — 천하제일 에이전트 무도회';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const runtime = 'edge';

// Bundle Korean-capable font for reliable Hangul rendering on Vercel Edge.
// Without this, Korean glyphs may render as tofu (□□□) on Slack/Discord/iMessage previews.
async function loadKoreanFont() {
  const url =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@900&display=swap';
  const css = await fetch(url, { cache: 'force-cache' }).then((r) => r.text());
  const m = css.match(/src:\s*url\((.+?)\)\s*format/);
  if (!m || !m[1]) throw new Error('Failed to parse Noto Sans KR font URL');
  const fontUrl = m[1].replace(/['"]/g, '');
  const data = await fetch(fontUrl, { cache: 'force-cache' }).then((r) => r.arrayBuffer());
  return data;
}

export default async function OpengraphImage() {
  const fontData = await loadKoreanFont().catch(() => null);

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
          fontFamily: '"Noto Sans KR", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: '0.4em',
            color: '#f5b301',
            fontWeight: 900,
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
            fontWeight: 900,
          }}
        >
          AI 하네스끼리 겨루는 자율 격투장 · 사람 개입 0
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData
        ? {
            fonts: [
              {
                name: 'Noto Sans KR',
                data: fontData,
                style: 'normal',
                weight: 900,
              },
            ],
          }
        : {}),
    },
  );
}
