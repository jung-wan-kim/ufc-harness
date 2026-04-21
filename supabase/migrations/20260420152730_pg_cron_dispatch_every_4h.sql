-- Schedule: every 4 hours, call dispatch-challenge Edge Function via pg_net.
-- Uses internal secret for auth (already stored in private.secrets).

-- Helper that wraps the HTTP call (so cron entry is clean)
CREATE OR REPLACE FUNCTION public.cron_dispatch_challenge()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions, pg_temp
AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT;
  v_request_id BIGINT;
BEGIN
  v_secret := private.get_secret('UFC_INTERNAL_SECRET');
  v_url := 'https://bypbtvpqjzqescijdqrb.supabase.co/functions/v1/dispatch-challenge';

  SELECT extensions.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_dispatch_challenge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_dispatch_challenge() TO service_role;

-- Schedule the cron job (every 4 hours at minute 0)
SELECT cron.schedule(
  'ufc-dispatch-every-4h',
  '0 */4 * * *',
  'SELECT public.cron_dispatch_challenge();'
);

-- Verify
SELECT jobid, schedule, command, jobname FROM cron.job WHERE jobname = 'ufc-dispatch-every-4h';
