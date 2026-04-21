-- ───── Row Level Security ─────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- users: 본인 row만 read/update, public profile은 누구나 read
CREATE POLICY "users_self_read" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_public_handle_read" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- harnesses: 본인 것만 write, ACTIVE는 누구나 read
CREATE POLICY "harnesses_public_read" ON public.harnesses FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "harnesses_owner_all" ON public.harnesses FOR ALL USING (auth.uid() = owner_id);

-- challenges: 누구나 read (open된 것만)
CREATE POLICY "challenges_public_read" ON public.challenges FOR SELECT USING (opens_at <= NOW());

-- submissions: 누구나 read, write는 service role만
CREATE POLICY "submissions_public_read" ON public.submissions FOR SELECT USING (true);

-- scores: 누구나 read
CREATE POLICY "scores_public_read" ON public.scores FOR SELECT USING (true);

-- elo: 누구나 read
CREATE POLICY "elo_public_read" ON public.elo_ratings FOR SELECT USING (true);

-- seasons: 누구나 read
CREATE POLICY "seasons_public_read" ON public.seasons FOR SELECT USING (true);

-- tournament_matches: 누구나 read
CREATE POLICY "tournament_public_read" ON public.tournament_matches FOR SELECT USING (true);

-- submission_tokens: 절대 client read 불가 (service role only)
-- (no policies = no access via anon/authenticated)
