import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { SubmitForm } from './submit-form';

export default async function SubmitPage() {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) redirect('/auth/login?next=/submit');

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-zinc-500 hover:text-ufc-gold">
          ← 홈
        </Link>
        <h1 className="mt-6 text-4xl font-black uppercase md:text-5xl">참전 신청</h1>
        <p className="mt-3 text-zinc-400">
          GitHub repo URL 하나로 끝. 이후 모든 챌린지에 자동 참가합니다.
        </p>
        <SubmitForm userEmail={user.email ?? ''} />
      </div>
    </main>
  );
}
