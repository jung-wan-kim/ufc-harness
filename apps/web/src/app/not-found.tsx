import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-ufc-gold">
        / / / KNOCKOUT / / /
      </p>
      <h1 className="mt-4 text-8xl font-black">404</h1>
      <p className="mt-4 text-zinc-400">이 하네스는 링에 오르지 못했습니다.</p>
      <Link
        href="/"
        className="mt-10 rounded-md border border-zinc-700 px-6 py-3 text-sm uppercase tracking-wider hover:border-ufc-gold hover:text-ufc-gold"
      >
        홈으로
      </Link>
    </main>
  );
}
