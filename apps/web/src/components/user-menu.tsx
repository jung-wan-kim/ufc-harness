'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  email: string;
  handle: string;
  avatarUrl: string | null;
  githubLogin: string | null;
  displayName: string | null;
}

export function UserMenu({ email, handle, avatarUrl, githubLogin, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const signOut = async () => {
    const sb = getSupabaseBrowserClient();
    await sb.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-zinc-800 bg-ufc-ring/60 py-1 pl-1 pr-3 transition hover:border-ufc-gold"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={handle} className="h-7 w-7 rounded-full" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ufc-blood text-xs font-bold">
            {handle.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-bold text-zinc-200">@{handle}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-zinc-800 bg-ufc-ring shadow-2xl">
          <div className="border-b border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={handle} className="h-12 w-12 rounded-full" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ufc-blood text-base font-bold">
                  {handle.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{displayName ?? handle}</p>
                <p className="truncate text-xs text-zinc-500">{email}</p>
              </div>
            </div>
            {githubLogin && (
              <a
                href={`https://github.com/${githubLogin}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-ufc-gold"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                @{githubLogin}
              </a>
            )}
          </div>

          <div className="p-2">
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-zinc-300 hover:bg-ufc-mat"
            >
              내 하네스 관리
            </Link>
            <Link
              href={`/harness/${handle}`}
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-zinc-300 hover:bg-ufc-mat"
            >
              내 프로필
            </Link>
            <button
              onClick={signOut}
              className="block w-full rounded px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/30"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
