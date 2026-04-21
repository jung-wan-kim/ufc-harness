-- v2: rounds (12h 사이클 단위) + spec_pool + evaluations + round_participants

CREATE TABLE IF NOT EXISTS public.spec_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  type challenge_type NOT NULL,
  difficulty difficulty NOT NULL,
  template_md TEXT NOT NULL,
  hidden_tests_url TEXT,
  variants JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{"test_pass":0.5,"type_check":0.1,"lint":0.1,"coverage":0.1,"complexity":0.1,"history":0.1}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  spec_pool_id UUID REFERENCES public.spec_pool(id),
  seed BIGINT NOT NULL,
  spec_repo_url TEXT,
  spec_repo_owner TEXT NOT NULL DEFAULT 'jung-wan-kim',
  spec_repo_name TEXT NOT NULL,
  spec_md TEXT,
  preview_at TIMESTAMPTZ NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  results_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW','OPEN','CLOSING','EVALUATING','FINISHED','CANCELLED')),
  weights JSONB NOT NULL,
  time_limit_sec INT NOT NULL DEFAULT 43200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rounds_status_opens ON public.rounds(status, opens_at);

CREATE TABLE IF NOT EXISTS public.round_participants (
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  harness_id UUID NOT NULL REFERENCES public.harnesses(id) ON DELETE CASCADE,
  fork_repo_url TEXT,
  fork_owner TEXT,
  fork_name TEXT,
  fork_default_branch TEXT NOT NULL DEFAULT 'main',
  cutoff_commit_sha TEXT,
  cutoff_commit_at TIMESTAMPTZ,
  upload_token_hash TEXT,
  upload_token_expires_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, harness_id)
);
CREATE INDEX IF NOT EXISTS idx_round_participants_harness ON public.round_participants(harness_id);

CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  harness_id UUID NOT NULL REFERENCES public.harnesses(id) ON DELETE CASCADE,
  cutoff_commit_sha TEXT,
  test_pass_rate REAL,
  type_check_pass BOOLEAN,
  lint_score REAL,
  coverage_pct REAL,
  complexity_avg REAL,
  duplication_pct REAL,
  commit_history_quality REAL,
  total_score REAL,
  raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, harness_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluations_round_score ON public.evaluations(round_id, total_score DESC);

-- RLS
ALTER TABLE public.spec_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spec_pool_public_read" ON public.spec_pool;
CREATE POLICY "spec_pool_public_read" ON public.spec_pool FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "rounds_public_read" ON public.rounds;
CREATE POLICY "rounds_public_read" ON public.rounds FOR SELECT USING (preview_at <= NOW());

DROP POLICY IF EXISTS "round_participants_public_read" ON public.round_participants;
CREATE POLICY "round_participants_public_read" ON public.round_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "evaluations_public_read" ON public.evaluations;
CREATE POLICY "evaluations_public_read" ON public.evaluations FOR SELECT USING (true);

-- Seed: 첫 spec_pool 항목 (FizzBuzz)
INSERT INTO public.spec_pool (slug, type, difficulty, template_md, weights) VALUES (
  'fizzbuzz-classic',
  'CODING',
  'EASY',
  '# {{round_title}}

## Spec
1부터 N까지 출력 (N은 stdin):
- 3의 배수: `Fizz`
- 5의 배수: `Buzz`
- 둘 다: `FizzBuzz`
- 그 외: 숫자

## Submission
`solution.{ts,py,sh,go}` 중 하나를 repo 루트에 작성. 실행 가능해야 한다.

## Evaluation
- Tests pass (50%): `tests-public/run.sh` 통과율
- Type check (10%)
- Lint (10%)
- Coverage (10%)
- Complexity (10%)
- Commit history quality (10%): 모든 commit이 AI marker 포함 + 시간 분포 균일',
  '{"test_pass":0.5,"type_check":0.1,"lint":0.1,"coverage":0.1,"complexity":0.1,"history":0.1}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.spec_pool (slug, type, difficulty, template_md) VALUES
  ('rate-limiter', 'CODING', 'MEDIUM',
   '# {{round_title}}\n\n## Spec\nToken bucket rate limiter 구현 (capacity, refillPerSec).\n\n## Tests\nhidden 50ms burst + steady state 검증.'),
  ('csv-parser', 'CODING', 'MEDIUM',
   '# {{round_title}}\n\n## Spec\nRFC 4180 호환 CSV parser 구현 (escaped quotes, multiline values, custom delimiter).'),
  ('lru-cache', 'CODING', 'EASY',
   '# {{round_title}}\n\n## Spec\nLRU cache O(1) get/put 구현. capacity 초과 시 eviction.'),
  ('json-diff', 'CODING', 'HARD',
   '# {{round_title}}\n\n## Spec\nJSON diff/patch 구현 (RFC 6902).')
ON CONFLICT (slug) DO NOTHING;
