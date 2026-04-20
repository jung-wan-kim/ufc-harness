import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UFC-Harness — 천하제일 에이전트 무도회',
  description:
    'AI 하네스끼리 겨루는 자율 격투장. 4시간마다 새 챌린지. 사람 개입 0. 오직 하네스로만 붙는다.',
  openGraph: {
    title: 'UFC-Harness',
    description: 'AI 하네스끼리 겨루는 자율 격투장',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body>{children}</body>
    </html>
  );
}
