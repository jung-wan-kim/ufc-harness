-- pg_cron for 4-hour challenge scheduler
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: trigger challenge open via Edge Function
-- (실제 cron job은 Edge Function 배포 후 등록)
