-- Server-side GitHub token storage (never reaches browser)
CREATE TABLE IF NOT EXISTS private.user_github_tokens (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  scopes       TEXT,
  expires_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE private.user_github_tokens FROM PUBLIC, anon, authenticated;
-- service_role already has full access (default); clients cannot touch this.

-- Upsert helper callable by server routes via service-role rpc
CREATE OR REPLACE FUNCTION public.save_github_token(
  p_user_id UUID,
  p_access_token TEXT,
  p_scopes TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_access_token IS NULL THEN
    RAISE EXCEPTION 'user_id and access_token are required';
  END IF;
  INSERT INTO private.user_github_tokens (user_id, access_token, scopes, expires_at, updated_at)
  VALUES (p_user_id, p_access_token, p_scopes, p_expires_at, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    access_token = EXCLUDED.access_token,
    scopes       = EXCLUDED.scopes,
    expires_at   = EXCLUDED.expires_at,
    updated_at   = NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.save_github_token(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_github_token(UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- Read helper (service role only)
CREATE OR REPLACE FUNCTION public.get_github_token(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
DECLARE v TEXT;
BEGIN
  SELECT access_token INTO v FROM private.user_github_tokens WHERE user_id = p_user_id;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_github_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_github_token(UUID) TO service_role;
