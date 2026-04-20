import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-ufc-blood">
        / / / KO / / /
      </p>
      <h1 className="mt-4 text-6xl font-black">로그인 실패</h1>
      <p className="mt-4 text-zinc-400">링크가 만료됐거나 코드가 유효하지 않다.</p>
      <Link
        href="/auth/login"
        className="mt-10 rounded-md border border-zinc-700 px-6 py-3 text-sm uppercase tracking-wider hover:border-ufc-gold hover:text-ufc-gold"
      >
        다시 로그인
      </Link>
    </main>
  );
}
