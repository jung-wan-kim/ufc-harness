import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { UserMenu } from './user-menu';

export async function SiteHeader() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  let profile: {
    handle: string | null;
    avatarUrl: string | null;
    displayName: string | null;
    githubLogin: string | null;
  } | null = null;

  if (user) {
    const { data } = await sb
      .from('users')
      .select('handle, avatar_url, display_name, github_login')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      profile = {
        handle: data.handle,
        avatarUrl: data.avatar_url,
        displayName: data.display_name,
        githubLogin: data.github_login,
      };
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900 bg-ufc-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-xl font-black uppercase tracking-tight">
            UFC<span className="text-ufc-blood">-</span>HARNESS
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold uppercase tracking-wider text-zinc-400 md:flex">
          <Link href="/rounds" className="hover:text-ufc-gold">
            라운드
          </Link>
          <Link href="/leaderboard" className="hover:text-ufc-gold">
            리더보드
          </Link>
          <Link href="/submit" className="hover:text-ufc-gold">
            참전
          </Link>
          <a
            href="https://github.com/jung-wan-kim/ufc-harness"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ufc-gold"
          >
            GitHub
          </a>
        </nav>

        {user && profile ? (
          <UserMenu
            email={user.email ?? ''}
            handle={profile.handle ?? user.id.slice(0, 6)}
            avatarUrl={profile.avatarUrl}
            githubLogin={profile.githubLogin}
            displayName={profile.displayName}
          />
        ) : (
          <Link
            href="/auth/login"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-zinc-200 transition hover:border-ufc-gold hover:text-ufc-gold"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
