-- 20260717141500_s50_inbox_documenti_nullable.sql
ALTER TABLE public.inbox_documenti ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE public.inbox_documenti ALTER COLUMN file_name DROP NOT NULL;
