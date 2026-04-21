-- Remove old 4h dispatch
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ufc-dispatch-every-4h';

-- v2 cron functions
CREATE OR REPLACE FUNCTION public.cron_open_round()
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, net, pg_temp
AS $$
DECLARE v_secret TEXT; v_req BIGINT;
BEGIN
  v_secret := private.get_secret('UFC_INTERNAL_SECRET');
  SELECT net.http_post(
    url := 'https://bypbtvpqjzqescijdqrb.supabase.co/functions/v1/open-round',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',v_secret),
    body := '{}'::jsonb
  ) INTO v_req;
  RETURN v_req;
END $$;

CREATE OR REPLACE FUNCTION public.cron_close_round()
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, net, pg_temp
AS $$
DECLARE v_secret TEXT; v_req BIGINT;
BEGIN
  v_secret := private.get_secret('UFC_INTERNAL_SECRET');
  SELECT net.http_post(
    url := 'https://bypbtvpqjzqescijdqrb.supabase.co/functions/v1/close-round',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',v_secret),
    body := '{}'::jsonb
  ) INTO v_req;
  RETURN v_req;
END $$;

REVOKE ALL ON FUNCTION public.cron_open_round() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_close_round() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_open_round() TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_close_round() TO service_role;

-- 12시간마다: 00:00 / 12:00 UTC — open next round (preview already exists from 12h ago)
SELECT cron.schedule(
  'ufc-open-round-12h',
  '0 0,12 * * *',
  'SELECT public.cron_open_round();'
);

-- 라운드 종료 30분 후: 00:30 / 12:30 UTC — harvest commits + evaluate
SELECT cron.schedule(
  'ufc-close-round-12h',
  '30 0,12 * * *',
  'SELECT public.cron_close_round();'
);

SELECT jobid, schedule, jobname FROM cron.job WHERE jobname LIKE 'ufc-%' ORDER BY jobname;
