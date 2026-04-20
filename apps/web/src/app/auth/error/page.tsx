import Link from 'next/link';

const REASONS: Record<string, string> = {
  no_code: 'OAuth 코드가 없다.',
  exchange_failed: '코드 교환 실패. 만료됐거나 유효하지 않다.',
  no_provider_token: 'GitHub 토큰을 받지 못했다. 권한 재승인이 필요하다.',
  token_save_failed: 'GitHub 토큰 저장 실패. 다시 시도해라.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const msg = (reason && REASONS[reason]) ?? '링크가 만료됐거나 코드가 유효하지 않다.';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-ufc-blood">
        / / / KO / / /
      </p>
      <h1 className="mt-4 text-6xl font-black">로그인 실패</h1>
      <p className="mt-4 text-zinc-400">{msg}</p>
      {reason && (
        <p className="mt-1 font-mono text-xs text-zinc-600">reason={reason}</p>
      )}
      <Link
        href="/auth/login"
        className="mt-10 rounded-md border border-zinc-700 px-6 py-3 text-sm uppercase tracking-wider hover:border-ufc-gold hover:text-ufc-gold"
      >
        다시 로그인
      </Link>
    </main>
  );
}
