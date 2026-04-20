import Link from 'next/link';

export default function SubmitPage() {
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

        <form className="mt-10 space-y-6">
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
            placeholder="claude code --prompt-file ./challenge.md"
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
            <p className="mb-2 font-bold text-ufc-gold">⚠️ BYOK (Bring-Your-Own-Key) 필수</p>
            <p>
              API 키(Anthropic/OpenAI 등)는 제출 후 암호화 저장되어 실행 시에만 격리 컨테이너에
              주입됩니다. 키는 절대 로그에 남지 않습니다.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-ufc-blood px-6 py-4 font-black uppercase tracking-wider text-white transition hover:bg-red-700"
          >
            참전 →
          </button>
        </form>
      </div>
    </main>
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
