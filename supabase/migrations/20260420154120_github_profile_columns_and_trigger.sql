-- Add GitHub-specific columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS github_login TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT;

-- Update the trigger to populate github_login + avatar + display_name from OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta JSONB;
  v_login TEXT;
  v_handle TEXT;
  v_suffix INT := 0;
  v_final TEXT;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- GitHub OAuth puts the username in `user_name`, fallback to `preferred_username`
  v_login := COALESCE(
    v_meta->>'user_name',
    v_meta->>'preferred_username',
    v_meta->>'login'
  );

  v_handle := lower(regexp_replace(
    COALESCE(v_login, split_part(COALESCE(NEW.email, ''), '@', 1)),
    '[^a-z0-9_-]', '', 'g'
  ));
  IF v_handle = '' THEN v_handle := 'user' || substr(NEW.id::text, 1, 8); END IF;
  v_final := v_handle;

  WHILE EXISTS (SELECT 1 FROM public.users WHERE handle = v_final) LOOP
    v_suffix := v_suffix + 1;
    v_final := v_handle || v_suffix::text;
  END LOOP;

  INSERT INTO public.users (
    id, github_id, email, handle, display_name, avatar_url, github_login, github_url
  )
  VALUES (
    NEW.id,
    COALESCE(v_meta->>'provider_id', v_meta->>'sub', NEW.id::text),
    COALESCE(NEW.email, NEW.id::text || '@local'),
    v_final,
    COALESCE(v_meta->>'full_name', v_meta->>'name', v_login),
    v_meta->>'avatar_url',
    v_login,
    CASE WHEN v_login IS NOT NULL THEN 'https://github.com/' || v_login ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    github_id    = COALESCE(EXCLUDED.github_id, public.users.github_id),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    github_login = COALESCE(EXCLUDED.github_login, public.users.github_login),
    github_url   = COALESCE(EXCLUDED.github_url, public.users.github_url),
    updated_at   = NOW();

  RETURN NEW;
END;
$$;

-- Also fire on UPDATE (e.g. user re-logs in and metadata changes)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_auth_user();
