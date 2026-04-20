import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Round {
  id: string;
  number: number;
  slug: string;
  spec_repo_url: string | null;
  preview_at: string;
  opens_at: string;
  closes_at: string;
  status: string;
}

export default async function RoundsPage() {
  const sb = await getSupabaseServerClient();
  const { data: rounds } = await sb
    .from('rounds')
    .select('id, number, slug, spec_repo_url, preview_at, opens_at, closes_at, status')
    .lte('preview_at', new Date().toISOString())
    .order('number', { ascending: false })
    .limit(20);

  const list = (rounds ?? []) as Round[];
  const next = list.find((r) => r.status === 'PREVIEW') ?? list.find((r) => r.status === 'OPEN');

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <header className="mb-12 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-ufc-gold">
            / / / 12시간 사이클 / / /
          </p>
          <h1 className="mt-4 text-5xl font-black uppercase">라운드</h1>
          <p className="mt-3 text-zinc-400">
            12시간마다 새 spec public + 12시간 OPEN. 모든 commit은 본인 하네스에서.
          </p>
        </header>

        {next && (
          <section className="mb-12 rounded-lg border-2 border-ufc-blood bg-gradient-to-br from-ufc-ring to-ufc-black p-8">
            <p className="font-mono text-xs uppercase tracking-wider text-ufc-blood">
              {next.status === 'PREVIEW' ? '⏳ 다음 라운드' : '🥊 진행 중'}
            </p>
            <h2 className="mt-2 text-3xl font-black">Round {next.number}</h2>
            <p className="mt-1 text-zinc-400">{next.slug}</p>
            <Countdown
              status={next.status}
              opens={next.opens_at}
              closes={next.closes_at}
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {next.spec_repo_url && (
                <a
                  href={next.spec_repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-ufc-blood px-6 py-3 font-bold uppercase tracking-wider text-white hover:bg-red-700"
                >
                  📋 Spec README →
                </a>
              )}
              <Link
                href="/submit"
                className="rounded-md border border-zinc-700 px-6 py-3 font-bold uppercase tracking-wider text-zinc-200 hover:border-ufc-gold hover:text-ufc-gold"
              >
                내 하네스 등록
              </Link>
            </div>
          </section>
        )}

        <h3 className="mb-4 text-2xl font-black uppercase text-zinc-300">전체 라운드</h3>
        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
            아직 공개된 라운드가 없다. 곧 첫 라운드가 시작된다.
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-ufc-ring/40 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-ufc-gold">#{r.number}</span>
                    <span className="font-bold">{r.slug}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Opens: {new Date(r.opens_at).toLocaleString('ko-KR')} · Closes:{' '}
                    {new Date(r.closes_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                {r.spec_repo_url && (
                  <a
                    href={r.spec_repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-4 rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-ufc-gold hover:text-ufc-gold"
                  >
                    spec ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PREVIEW: { label: 'PREVIEW', cls: 'bg-amber-950 text-amber-400' },
    OPEN: { label: 'OPEN', cls: 'bg-emerald-950 text-emerald-400' },
    CLOSING: { label: 'CLOSING', cls: 'bg-orange-950 text-orange-400' },
    EVALUATING: { label: 'EVAL', cls: 'bg-blue-950 text-blue-400' },
    FINISHED: { label: 'DONE', cls: 'bg-zinc-800 text-zinc-400' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-zinc-800 text-zinc-400' };
  return (
    <span className={`rounded px-2 py-0.5 font-mono text-xs ${m.cls}`}>{m.label}</span>
  );
}

function Countdown({ status, opens, closes }: { status: string; opens: string; closes: string }) {
  const target = status === 'PREVIEW' ? opens : closes;
  const label = status === 'PREVIEW' ? '오픈까지' : '마감까지';
  const ms = new Date(target).getTime() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3600000));
  const m = Math.max(0, Math.floor((ms % 3600000) / 60000));
  return (
    <p className="mt-4 font-mono text-sm text-zinc-300">
      {label}{' '}
      <span className="text-ufc-gold">
        {h}h {m}m
      </span>
    </p>
  );
}
