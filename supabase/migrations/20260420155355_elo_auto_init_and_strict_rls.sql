-- 1) Auto-create elo_ratings row on every new harness (server-controlled)
CREATE OR REPLACE FUNCTION public.handle_new_harness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.elo_ratings (harness_id, rating, games_played, wins, losses, draws)
  VALUES (NEW.id, 1500, 0, 0, 0, 0)
  ON CONFLICT (harness_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_harness_created ON public.harnesses;
CREATE TRIGGER on_harness_created
  AFTER INSERT ON public.harnesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_harness();

-- 2) Lock down elo_ratings: NO direct client writes (server/trigger only)
DROP POLICY IF EXISTS "elo_owner_insert" ON public.elo_ratings;
DROP POLICY IF EXISTS "elo_owner_update" ON public.elo_ratings;
-- existing "elo_public_read" stays — anyone can read
-- INSERT/UPDATE/DELETE require service_role (no policy = denied for anon/authenticated)

-- 3) Strict harness write policy: WITH CHECK enforces owner_id from auth.uid()
DROP POLICY IF EXISTS "harnesses_owner_all" ON public.harnesses;
CREATE POLICY "harnesses_insert_self" ON public.harnesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "harnesses_update_self" ON public.harnesses
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "harnesses_delete_self" ON public.harnesses
  FOR DELETE USING (auth.uid() = owner_id);
-- existing "harnesses_public_read" (status=ACTIVE) stays

-- 4) Submissions: clients can READ only, never write directly
-- (existing "submissions_public_read" is fine; absence of INSERT/UPDATE policies = denied)

-- 5) Verify
SELECT polname, polcmd, polqual, polwithcheck
FROM pg_policy
WHERE polrelid IN ('public.harnesses'::regclass, 'public.elo_ratings'::regclass)
ORDER BY polrelid::text, polname;
