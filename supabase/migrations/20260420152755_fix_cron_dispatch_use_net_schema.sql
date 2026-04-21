CREATE OR REPLACE FUNCTION public.cron_dispatch_challenge()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, net, pg_temp
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  v_secret := private.get_secret('UFC_INTERNAL_SECRET');

  SELECT net.http_post(
    url := 'https://bypbtvpqjzqescijdqrb.supabase.co/functions/v1/dispatch-challenge',
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
