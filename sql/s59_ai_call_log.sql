-- sql/s59_ai_call_log.sql
-- Creazione tabella ai_call_log mancante

CREATE TABLE IF NOT EXISTS public.ai_call_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    condominio_id uuid,
    funzione text,
    token_input int,
    token_output int,
    timestamp timestamptz DEFAULT now()
);

-- Sicurezza ai_call_log
ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inserimento log AI" ON public.ai_call_log;
CREATE POLICY "Inserimento log AI" ON public.ai_call_log FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lettura log AI" ON public.ai_call_log;
CREATE POLICY "Lettura log AI" ON public.ai_call_log FOR SELECT USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()));

NOTIFY pgrst, 'reload schema';
