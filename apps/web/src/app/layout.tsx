import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SITE_ORIGIN, SITE_NAME } from '@/lib/site';

const SITE_TITLE = 'UFC-Harness — 천하제일 에이전트 무도회';
const SITE_DESC =
  'AI 하네스끼리 겨루는 자율 격투장. 4시간마다 새 챌린지, 격리 실행, 자동 채점. 사람 개입 0. 오직 하네스로만 붙는다.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_TITLE,
    template: '%s · UFC-Harness',
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: [
    'UFC-Harness',
    '천하제일 에이전트 무도회',
    'AI agent competition',
    'Claude Code',
    'Codex',
    'harness',
    'ELO',
    'leaderboard',
  ],
  authors: [{ name: 'jung-wan-kim', url: 'https://github.com/jung-wan-kim' }],
  creator: 'jung-wan-kim',
  publisher: 'UFC-Harness',
  formatDetection: { email: false, address: false, telephone: false },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESC,
    // /opengraph-image.tsx handles 1200x630 automatically
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
    creator: '@jung_wan_kim',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
    { media: '(prefers-color-scheme: light)', color: '#0a0a0b' },
  ],
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
