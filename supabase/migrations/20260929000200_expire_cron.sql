-- Expire unconfirmed orders every 5 minutes (SPEC §5.6). Kept apart from the
-- orders migration because local checks run on Postgres without pg_cron.

create extension if not exists pg_cron;

select cron.schedule('expire-orders', '*/5 * * * *', 'select public.expire_orders()');
