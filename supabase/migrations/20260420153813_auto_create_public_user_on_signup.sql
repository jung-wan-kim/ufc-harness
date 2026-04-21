-- Cleanup test data
DELETE FROM public.submissions WHERE harness_id IN (SELECT id FROM public.harnesses WHERE slug = 'judge-test-harness');
DELETE FROM public.harnesses WHERE slug = 'judge-test-harness';
DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Restore FK
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Trigger function: auto-create public.users on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handle TEXT;
  v_suffix INT := 0;
  v_final TEXT;
BEGIN
  v_handle := lower(regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
  IF v_handle = '' THEN v_handle := 'user' || substr(NEW.id::text, 1, 8); END IF;
  v_final := v_handle;

  -- Resolve handle collision by appending number
  WHILE EXISTS (SELECT 1 FROM public.users WHERE handle = v_final) LOOP
    v_suffix := v_suffix + 1;
    v_final := v_handle || v_suffix::text;
  END LOOP;

  INSERT INTO public.users (id, github_id, email, handle)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'provider_id', NEW.id::text),
    COALESCE(NEW.email, NEW.id::text || '@local'),
    v_final
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
