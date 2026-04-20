import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { SubmitForm } from './submit-form';

export const dynamic = 'force-dynamic';

export default async function SubmitPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) redirect('/auth/login?next=/submit');

  // Fetch user's existing harnesses
  const { data: harnesses } = await sb
    .from('harnesses')
    .select('id, name, slug, repo_url, runtime, status, created_at, elo:elo_ratings(rating, wins, losses)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  // Get GitHub provider token from session for repo fetching
  const { data: { session } } = await sb.auth.getSession();
  const ghToken = session?.provider_token ?? null;

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-zinc-500 hover:text-ufc-gold">
          ← 홈
        </Link>

        {harnesses && harnesses.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-4 text-2xl font-black uppercase">내 하네스</h2>
            <div className="space-y-2">
              {harnesses.map((h) => {
                const elo = Array.isArray(h.elo) ? h.elo[0] : h.elo;
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-ufc-ring/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="truncate font-bold">{h.name}</p>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-mono ${
                            h.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {h.status}
                        </span>
                        <span className="rounded border border-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-500">
                          {h.runtime}
                        </span>
                      </div>
                      <a
                        href={h.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-500 hover:text-ufc-gold"
                      >
                        {h.repo_url.replace('https://', '')}
                      </a>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-lg font-bold text-ufc-gold">{elo?.rating ?? 1500}</p>
                      <p className="text-xs text-zinc-500">
                        {elo?.wins ?? 0}W / {elo?.losses ?? 0}L
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <h1 className="mt-12 text-4xl font-black uppercase md:text-5xl">
          {harnesses && harnesses.length > 0 ? '하네스 추가' : '참전 신청'}
        </h1>
        <p className="mt-3 text-zinc-400">
          GitHub repo 골라서 등록하면 4시간마다 자동 참가한다.
        </p>

        <SubmitForm hasGithubToken={!!ghToken} />
      </div>
    </main>
  );
}
