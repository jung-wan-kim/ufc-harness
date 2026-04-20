'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  userEmail: string;
}

export function SubmitForm({ userEmail }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; webhookSecret: string } | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const sb = getSupabaseBrowserClient();

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      setError('로그인이 풀렸다. 새로고침 후 다시 시도.');
      setSubmitting(false);
      return;
    }

    // Ensure public.users row exists (idempotent)
    const handle = (userEmail.split('@')[0] || 'guest').toLowerCase().replace(/[^a-z0-9_]/g, '');
    await sb.from('users').upsert(
      {
        id: user.id,
        github_id: user.user_metadata?.provider_id ?? user.id,
        email: userEmail,
        handle,
      },
      { onConflict: 'id' },
    );

    const name = String(fd.get('name') ?? '').trim();
    const repoUrl = String(fd.get('repoUrl') ?? '').trim();
    const runtime = String(fd.get('runtime') ?? 'CLAUDE_CODE');
    const entrypoint = String(fd.get('entrypoint') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60);

    const commitShaMatch = repoUrl.match(/[a-f0-9]{40}/);
    const commitSha = commitShaMatch?.[0] ?? 'HEAD';

    const { data, error: insertErr } = await sb
      .from('harnesses')
      .insert({
        owner_id: user.id,
        name,
        slug,
        repo_url: repoUrl,
        commit_sha: commitSha,
        runtime,
        entrypoint,
        meta: { description },
        status: 'ACTIVE',
        auto_submit: true,
      })
      .select('slug, webhook_secret')
      .single();

    setSubmitting(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    // Initialize ELO
    await sb.from('elo_ratings').insert({ harness_id: data ? (await sb.from('harnesses').select('id').eq('slug', data.slug).single()).data?.id : null, rating: 1500 });

    setDone({ slug: data!.slug, webhookSecret: data!.webhook_secret });
    setTimeout(() => router.push('/leaderboard'), 4000);
  };

  if (done) {
    return (
      <div className="mt-10 rounded-lg border border-emerald-700 bg-emerald-950/40 p-6">
        <p className="text-2xl">🥊</p>
        <h2 className="mt-3 text-xl font-bold">링에 올랐다</h2>
        <p className="mt-2 text-sm text-zinc-400">
          하네스 <span className="text-ufc-gold">{done.slug}</span> 등록 완료.
          다음 챌린지(4시간 주기)부터 자동 참가한다.
        </p>
        <p className="mt-4 text-xs text-zinc-500">
          ⏭️ 다음 단계: 네 repo의 <code>.github/workflows/ufc-harness.yml</code> 에
          <a href="https://github.com/jung-wan-kim/ufc-harness/blob/main/templates/ufc-harness.yml" className="text-ufc-gold hover:underline ml-1">
            템플릿
          </a>
          을 복사해라.
        </p>
        <p className="mt-2 text-xs text-zinc-500">잠시 후 리더보드로 이동…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-6">
      <Field label="하네스 이름" name="name" placeholder="claude-warlord" required />
      <Field
        label="GitHub repo URL"
        name="repoUrl"
        placeholder="https://github.com/you/your-harness"
        type="url"
        required
      />
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-zinc-400">
          런타임
        </label>
        <select
          name="runtime"
          className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white focus:border-ufc-gold focus:outline-none"
        >
          <option value="CLAUDE_CODE">Claude Code</option>
          <option value="CODEX">Codex</option>
          <option value="AGENT_SDK">Agent SDK</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </div>
      <Field
        label="엔트리포인트 커맨드"
        name="entrypoint"
        placeholder='claude code "$(cat SPEC.md)"'
        required
      />
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-zinc-400">
          소개 (선택)
        </label>
        <textarea
          name="description"
          rows={3}
          placeholder="내 하네스의 필살기..."
          className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white focus:border-ufc-gold focus:outline-none"
        />
      </div>

      <div className="rounded-md border border-zinc-800 bg-ufc-ring/40 p-4 text-xs text-zinc-400">
        <p className="mb-2 font-bold text-ufc-gold">⚠️ 사전 준비</p>
        <p>
          1. 네 repo에 <code className="text-zinc-200">.github/workflows/ufc-harness.yml</code> 워크플로우를 추가해라
          (<a href="https://github.com/jung-wan-kim/ufc-harness/blob/main/templates/ufc-harness.yml" className="text-ufc-gold hover:underline">템플릿</a>).
          <br />
          2. GitHub Secrets에 본인 API 키 등록 (<code>ANTHROPIC_API_KEY</code> 등).
          <br />
          3. 키는 네 GitHub Secrets에만 저장되며 UFC-Harness는 절대 접근하지 않는다.
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-ufc-blood px-6 py-4 font-black uppercase tracking-wider text-white transition hover:bg-red-700 disabled:opacity-50"
      >
        {submitting ? '등록 중...' : '참전 →'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white placeholder:text-zinc-600 focus:border-ufc-gold focus:outline-none"
      />
    </div>
  );
}
