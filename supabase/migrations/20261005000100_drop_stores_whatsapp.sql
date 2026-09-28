-- Stage 08 follow-up: stores.whatsapp was kept only so the previous deploy
-- kept working while 20261004000100 was applied. The code now reads the
-- three sector columns.
alter table public.stores drop column whatsapp;
