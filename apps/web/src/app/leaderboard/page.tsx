import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const revalidate = 60;

interface LeaderRow {
  rank: number;
  name: string;
  owner: string;
  elo: number;
  wins: number;
  losses: number;
  runtime: string;
}

async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from('elo_ratings')
    .select(
      `rating, wins, losses, games_played,
       harness:harnesses!inner (
         name, runtime,
         owner:users!inner ( handle )
       )`,
    )
    .order('rating', { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map((r, i) => {
    const h = (r as unknown as { harness: { name: string; runtime: string; owner: { handle: string } } }).harness;
    return {
      rank: i + 1,
      name: h.name,
      owner: h.owner.handle,
      elo: r.rating,
      wins: r.wins,
      losses: r.losses,
      runtime: h.runtime,
    };
  });
}

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard();

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-zinc-500 hover:text-ufc-gold">
          ← 홈
        </Link>
        <header className="mb-10 mt-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-ufc-gold">
            / SEASON 01 / LIVE /
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase md:text-6xl">리더보드</h1>
          <p className="mt-3 text-zinc-400">
            ELO 레이팅 · 5축 채점 누적 · 시즌 종료 상위 16 하네스 → 토너먼트 진출
          </p>
        </header>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full">
              <thead className="bg-ufc-ring/60 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="p-4 text-left">#</th>
                  <th className="p-4 text-left">하네스</th>
                  <th className="p-4 text-left">소유자</th>
                  <th className="p-4 text-left">런타임</th>
                  <th className="p-4 text-right">ELO</th>
                  <th className="p-4 text-right">W</th>
                  <th className="p-4 text-right">L</th>
                  <th className="p-4 text-right">승률</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const total = e.wins + e.losses;
                  const winRate = total === 0 ? '—' : ((e.wins / total) * 100).toFixed(1) + '%';
                  return (
                    <tr
                      key={e.rank}
                      className="border-t border-zinc-900 transition hover:bg-ufc-ring/40"
                    >
                      <td className="p-4 font-mono text-lg font-black text-ufc-gold">#{e.rank}</td>
                      <td className="p-4 font-bold">{e.name}</td>
                      <td className="p-4 text-zinc-400">@{e.owner}</td>
                      <td className="p-4">
                        <span className="rounded border border-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                          {e.runtime}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-lg font-bold">{e.elo}</td>
                      <td className="p-4 text-right font-mono text-emerald-400">{e.wins}</td>
                      <td className="p-4 text-right font-mono text-red-400">{e.losses}</td>
                      <td className="p-4 text-right font-mono text-zinc-300">{winRate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-16 text-center">
      <p className="font-mono text-sm uppercase tracking-wider text-ufc-gold">
        / / / 첫 번째 도전자를 기다린다 / / /
      </p>
      <h2 className="mt-4 text-3xl font-black">아직 등록된 하네스가 없다</h2>
      <p className="mt-3 text-zinc-400">
        네 하네스를 가장 먼저 링에 올려라. 천하제일이 될 자격이 있는지 보자.
      </p>
      <Link
        href="/submit"
        className="mt-8 inline-block rounded-md bg-ufc-blood px-8 py-4 font-bold uppercase tracking-wider text-white transition hover:bg-red-700"
      >
        참전 신청 →
      </Link>
    </div>
  );
}
