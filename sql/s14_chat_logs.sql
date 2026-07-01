-- sql/s14_chat_logs.sql
-- Tabella temporanea (30 giorni) per i log delle chat di assistenza

CREATE TABLE IF NOT EXISTS public.chat_assistenza_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trascrizione TEXT NOT NULL,
    risolto_con_ticket BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.chat_assistenza_logs ENABLE ROW LEVEL SECURITY;

-- Gli utenti possono solo inserire i propri log
CREATE POLICY "Users can insert own chat logs" 
ON public.chat_assistenza_logs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Solo i superadmin possono leggere i log (sfruttando la funzione creata in s13_backoffice.sql)
CREATE POLICY "Superadmin can read all chat logs" 
ON public.chat_assistenza_logs FOR SELECT 
TO authenticated 
USING (public.is_superadmin(auth.uid()));


-- ESTENSIONE PG_CRON E TASK PER LA CANCELLAZIONE A 30 GIORNI
-- Nota: L'esecuzione di pg_cron e l'aggiunta di job richiede permessi elevati (postgres o rds_superuser).
-- In Supabase la Dashboard gestisce automaticamente questa estensione sotto "Database > Extensions".
DO $$
BEGIN
  -- Se l'estensione non è attiva, tentiamo di crearla
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  
  -- Se ha avuto successo (o era già attiva), scheduliamo il cron job
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_chat_logs_30d',
      '0 0 * * *', -- Esegue ogni giorno a mezzanotte
      $cmd$ DELETE FROM public.chat_assistenza_logs WHERE created_at < NOW() - INTERVAL '30 days' $cmd$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignoriamo se l'utente non ha i permessi da CLI per pg_cron.
    -- Basterà abilitare l'estensione pg_cron manualmente dalla dashboard Supabase.
    RAISE NOTICE 'Impossibile configurare cron job in automatico: permessi insufficienti o estensione non attiva.';
END $$;
