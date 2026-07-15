-- sql/s42_gemini_rate_limit.sql
-- Rinoma la tabella claude_rate_limit in gemini_rate_limit se esiste, altrimenti la crea.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'claude_rate_limit') THEN
    ALTER TABLE public.claude_rate_limit RENAME TO gemini_rate_limit;
    RAISE NOTICE 'Tabella claude_rate_limit rinominata con successo in gemini_rate_limit';
  ELSE
    CREATE TABLE IF NOT EXISTS public.gemini_rate_limit (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    ALTER TABLE public.gemini_rate_limit ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Tabella gemini_rate_limit creata con successo';
  END IF;
END $$;
