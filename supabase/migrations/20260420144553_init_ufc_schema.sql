-- ───── Enums ─────
CREATE TYPE user_plan AS ENUM ('FREE', 'PRO', 'TEAM');
CREATE TYPE harness_runtime AS ENUM ('CLAUDE_CODE', 'CODEX', 'AGENT_SDK', 'CUSTOM');
CREATE TYPE harness_status AS ENUM ('ACTIVE', 'PAUSED', 'BANNED');
CREATE TYPE challenge_type AS ENUM ('CODING', 'BUG_FIX', 'REFACTOR', 'FULLSTACK', 'ADVERSARIAL');
CREATE TYPE difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');
CREATE TYPE submission_status AS ENUM ('QUEUED', 'DISPATCHED', 'RUNNING', 'EVALUATING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'BANNED');
CREATE TYPE season_status AS ENUM ('UPCOMING', 'ACTIVE', 'TOURNAMENT', 'FINISHED');

-- ───── Users (extends Supabase auth.users) ─────
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  plan user_plan NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_handle ON public.users(handle);

-- ───── Harnesses ─────
CREATE TABLE public.harnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  runtime harness_runtime NOT NULL,
  entrypoint TEXT NOT NULL,
  meta JSONB,
  status harness_status NOT NULL DEFAULT 'ACTIVE',
  auto_submit BOOLEAN NOT NULL DEFAULT TRUE,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, slug)
);
CREATE INDEX idx_harnesses_status ON public.harnesses(status);
CREATE INDEX idx_harnesses_owner ON public.harnesses(owner_id);

-- ───── Seasons ─────
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status season_status NOT NULL DEFAULT 'UPCOMING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───── Challenges ─────
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  type challenge_type NOT NULL,
  difficulty difficulty NOT NULL,
  title TEXT NOT NULL,
  spec_md TEXT NOT NULL,
  test_suite_url TEXT NOT NULL,
  weights JSONB NOT NULL,
  time_limit_sec INT NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  season_id UUID REFERENCES public.seasons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_challenges_opens_at ON public.challenges(opens_at);

-- ───── Submissions ─────
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harness_id UUID NOT NULL REFERENCES public.harnesses(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  status submission_status NOT NULL DEFAULT 'QUEUED',
  github_run_id TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  workspace_url TEXT,
  log_url TEXT,
  diff_url TEXT,
  diff_hash TEXT,
  tokens_used INT,
  api_calls INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (harness_id, challenge_id)
);
CREATE INDEX idx_submissions_status_created ON public.submissions(status, created_at);
CREATE INDEX idx_submissions_challenge ON public.submissions(challenge_id);

-- ───── Submission Tokens (single-use, GHA → Supabase upload) ─────
CREATE TABLE public.submission_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_submission_tokens_hash ON public.submission_tokens(token_hash) WHERE used_at IS NULL;

-- ───── Scores ─────
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID UNIQUE NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  correctness REAL NOT NULL CHECK (correctness >= 0 AND correctness <= 100),
  quality REAL NOT NULL CHECK (quality >= 0 AND quality <= 100),
  efficiency REAL NOT NULL CHECK (efficiency >= 0 AND efficiency <= 100),
  robustness REAL NOT NULL CHECK (robustness >= 0 AND robustness <= 100),
  elegance REAL NOT NULL CHECK (elegance >= 0 AND elegance <= 100),
  total REAL NOT NULL,
  judge_trace JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scores_total ON public.scores(total DESC);

-- ───── ELO Ratings ─────
CREATE TABLE public.elo_ratings (
  harness_id UUID PRIMARY KEY REFERENCES public.harnesses(id) ON DELETE CASCADE,
  rating INT NOT NULL DEFAULT 1500,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_elo_rating ON public.elo_ratings(rating DESC);

-- ───── Tournament Matches ─────
CREATE TABLE public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id),
  round INT NOT NULL,
  harness_a_id UUID NOT NULL REFERENCES public.harnesses(id),
  harness_b_id UUID NOT NULL REFERENCES public.harnesses(id),
  winner_id UUID REFERENCES public.harnesses(id),
  replay_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───── updated_at trigger ─────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_harnesses_updated_at BEFORE UPDATE ON public.harnesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_elo_updated_at BEFORE UPDATE ON public.elo_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
