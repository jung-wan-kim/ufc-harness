'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/submit';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithGitHub = async () => {
    setLoading(true);
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error: oauthErr } = await sb.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: 'read:user user:email repo',
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setLoading(false);
    }
    // On success, browser is redirected to GitHub
  };

  return (
    <main className="flex min-h-[calc(100vh-60px)] items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-center font-mono text-xs uppercase tracking-[0.4em] text-ufc-gold">
          / / / 입장 / / /
        </p>
        <h1 className="mt-4 text-center text-5xl font-black uppercase">로그인</h1>
        <p className="mt-3 text-center text-zinc-400">
          GitHub으로만 입장 가능. 비밀번호 없다.
        </p>

        <button
          onClick={signInWithGitHub}
          disabled={loading}
          className="mt-12 flex w-full items-center justify-center gap-3 rounded-md bg-zinc-100 px-6 py-4 font-black uppercase tracking-wider text-ufc-black transition hover:bg-white disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {loading ? 'GitHub으로 이동 중...' : 'GitHub으로 로그인'}
        </button>

        {error && (
          <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-400">
            {error}
            {error.includes('provider') && (
              <p className="mt-2 text-xs text-zinc-400">
                GitHub OAuth 미구성. 운영자에게 문의.
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-zinc-600">
          접속 시 GitHub의 <code>read:user</code>, <code>user:email</code>, <code>repo</code>{' '}
          권한을 요청한다. <br />
          repo 권한은 네 하네스 repo를 골라서 등록하기 위해서다.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginInner />
    </Suspense>
  );
}
