'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  pushed_at: string;
  language: string | null;
}

interface Props {
  hasGithubToken: boolean;
}

export function SubmitForm({ hasGithubToken }: Props) {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  useEffect(() => {
    if (!hasGithubToken) return;
    void loadRepos();
  }, [hasGithubToken]);

  // Server-side proxy: provider_token never reaches the browser.
  const loadRepos = async () => {
    setLoadingRepos(true);
    setReposError(null);
    try {
      const res = await fetch('/api/github/repos', { cache: 'no-store' });
      if (res.status === 401) {
        setReposError('GitHub 토큰 만료. 재로그인 필요.');
        return;
      }
      if (!res.ok) {
        setReposError(`GitHub 호출 실패 (${res.status})`);
        return;
      }
      const json = (await res.json()) as { repos: Repo[] };
      setRepos(json.repos);
    } catch (e) {
      setReposError((e as Error).message);
    } finally {
      setLoadingRepos(false);
    }
  };

  const filtered = repos.filter(
    (r) =>
      !search ||
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRepo) {
      setError('하네스 repo를 골라라.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? selectedRepo.name).trim();
    const runtime = String(fd.get('runtime') ?? 'CLAUDE_CODE');
    const entrypoint = String(fd.get('entrypoint') ?? '').trim();
    const description = String(fd.get('description') ?? selectedRepo.description ?? '').trim();

    // SERVER-SIDE INSERT — owner_id, repo_url, commit_sha derived from session+GH API,
    // not from client. Repo ownership re-verified server-side.
    const res = await fetch('/api/harnesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_repo_id: selectedRepo.id,
        name,
        runtime,
        entrypoint,
        description,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { id: string; slug: string };
    setDone({ slug: data.slug });
    setTimeout(() => {
      router.push('/leaderboard');
      router.refresh();
    }, 4000);
  };

  if (!hasGithubToken) {
    return (
      <div className="mt-10 rounded-lg border border-amber-700 bg-amber-950/30 p-6">
        <p className="font-bold text-amber-300">GitHub 토큰 만료</p>
        <p className="mt-2 text-sm text-zinc-400">
          repo 목록을 가져오려면 GitHub 권한이 필요하다. 다시 로그인해라.
        </p>
        <Link
          href="/auth/login?next=/submit"
          className="mt-4 inline-block rounded-md bg-ufc-blood px-4 py-2 text-sm font-bold uppercase text-white hover:bg-red-700"
        >
          GitHub 재로그인
        </Link>
      </div>
    );
  }

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
          ⏭️ <strong>네 repo에 워크플로우를 추가해라</strong>:
          <code className="ml-1 rounded bg-zinc-900 px-1.5 py-0.5">.github/workflows/ufc-harness.yml</code>
          {' → '}
          <a
            href="https://github.com/jung-wan-kim/ufc-harness/blob/main/templates/ufc-harness.yml"
            className="text-ufc-gold hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            템플릿
          </a>
        </p>
        <p className="mt-2 text-xs text-zinc-500">잠시 후 리더보드로 이동…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-6">
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-zinc-400">
          하네스 repo 선택
        </label>
        {selectedRepo ? (
          <div className="rounded-md border border-ufc-gold bg-ufc-ring/60 p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate font-bold">{selectedRepo.full_name}</p>
                {selectedRepo.description && (
                  <p className="mt-1 text-xs text-zinc-400">{selectedRepo.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {selectedRepo.private && (
                    <span className="rounded bg-amber-950 px-2 py-0.5 text-amber-400">private</span>
                  )}
                  {selectedRepo.language && (
                    <span className="rounded border border-zinc-800 px-2 py-0.5 text-zinc-500">
                      {selectedRepo.language}
                    </span>
                  )}
                  <span className="text-zinc-600">@ {selectedRepo.default_branch}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRepo(null)}
                className="text-xs text-zinc-500 hover:text-ufc-gold"
              >
                변경
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={loadingRepos ? '로딩...' : `검색 (${repos.length}개 repo)`}
              className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white placeholder:text-zinc-600 focus:border-ufc-gold focus:outline-none"
              disabled={loadingRepos}
            />
            {reposError && (
              <p className="mt-2 text-xs text-red-400">{reposError}</p>
            )}
            {filtered.length > 0 && (
              <ul className="mt-2 max-h-80 overflow-y-auto rounded-md border border-zinc-800 bg-ufc-ring/40">
                {filtered.slice(0, 30).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRepo(r);
                        setSearch('');
                      }}
                      className="w-full border-b border-zinc-900 p-3 text-left transition hover:bg-ufc-mat"
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-bold">{r.full_name}</span>
                        {r.private && (
                          <span className="ml-2 shrink-0 rounded bg-amber-950 px-1.5 py-0.5 text-xs text-amber-400">
                            private
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-1 truncate text-xs text-zinc-500">{r.description}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!loadingRepos && repos.length === 0 && !reposError && (
              <p className="mt-2 text-xs text-zinc-500">repo 목록을 가져오는 중...</p>
            )}
          </div>
        )}
      </div>

      {selectedRepo && (
        <>
          <Field
            label="하네스 이름"
            name="name"
            placeholder={selectedRepo.name}
            defaultValue={selectedRepo.name}
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
              rows={2}
              defaultValue={selectedRepo.description ?? ''}
              className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white focus:border-ufc-gold focus:outline-none"
            />
          </div>

          <div className="rounded-md border border-zinc-800 bg-ufc-ring/40 p-4 text-xs text-zinc-400">
            <p className="mb-2 font-bold text-ufc-gold">⚠️ 사전 준비</p>
            <p>
              1. <code className="text-zinc-200">{selectedRepo.full_name}</code> repo의{' '}
              <code className="text-zinc-200">.github/workflows/</code> 에{' '}
              <a
                href="https://github.com/jung-wan-kim/ufc-harness/blob/main/templates/ufc-harness.yml"
                target="_blank"
                rel="noreferrer"
                className="text-ufc-gold hover:underline"
              >
                ufc-harness.yml 템플릿
              </a>
              을 추가해라.
              <br />
              2. 그 repo의 GitHub Secrets에 본인 API 키 등록 (<code>ANTHROPIC_API_KEY</code> 등).
              <br />
              3. 키는 GitHub Secrets에만 저장. UFC-Harness는 절대 접근하지 않는다.
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
        </>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = 'text',
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-800 bg-ufc-ring px-4 py-3 text-white placeholder:text-zinc-600 focus:border-ufc-gold focus:outline-none"
      />
    </div>
  );
}
