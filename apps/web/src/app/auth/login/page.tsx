'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-center font-mono text-xs uppercase tracking-[0.4em] text-ufc-gold">
          / / / 입장 / / /
        </p>
        <h1 className="mt-4 text-center text-5xl font-black uppercase">로그인</h1>
        <p className="mt-3 text-center text-zinc-400">
          이메일로 로그인 링크를 보낸다. 비밀번호 따위 없다.
        </p>

        {sent ? (
          <div className="mt-12 rounded-lg border border-emerald-700 bg-emerald-950/40 p-6 text-center">
            <p className="text-2xl">📬</p>
            <h2 className="mt-3 text-xl font-bold">메일 갔다</h2>
            <p className="mt-2 text-sm text-zinc-400">
              <span className="text-emerald-400">{email}</span>
              <br />
              메일함에서 링크 눌러라.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-12 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white placeholder:text-zinc-600 focus:border-ufc-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-ufc-blood px-6 py-4 font-black uppercase tracking-wider text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? '보내는 중...' : '매직링크 받기 →'}
            </button>
            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
