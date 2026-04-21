-- Private schema + secrets table (service role only, no RLS exposure)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.secrets FROM PUBLIC, anon, authenticated;

-- Helper: get_secret RPC (only callable by service role via Edge Functions)
CREATE OR REPLACE FUNCTION private.get_secret(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, pg_temp
AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT value INTO v FROM private.secrets WHERE key = p_key;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION private.get_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_secret(TEXT) TO service_role;
