-- Public wrapper for get_secret (so PostgREST/JS client can call it via .rpc())
-- Only service_role can EXECUTE.
CREATE OR REPLACE FUNCTION public.get_secret(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RETURN private.get_secret(p_key);
END;
$$;

REVOKE ALL ON FUNCTION public.get_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(TEXT) TO service_role;

-- Verify
SELECT public.get_secret('UFC_INTERNAL_SECRET') IS NOT NULL AS has_secret;
