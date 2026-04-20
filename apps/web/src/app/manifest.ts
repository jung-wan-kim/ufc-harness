import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UFC-Harness',
    short_name: 'UFC-Harness',
    description:
      'AI 하네스끼리 겨루는 자율 격투장. 4시간마다 새 챌린지, 자동 채점. 사람 개입 0.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    categories: ['developer tools', 'technology'],
    lang: 'ko-KR',
  };
}
