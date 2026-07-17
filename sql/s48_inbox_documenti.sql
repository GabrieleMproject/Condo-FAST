-- =============================================================================
-- S48 — POSTBOX CENTRALIZZATA ED INGESTIONE EMAIL + ALLINEAMENTO S37 COLLABORATORI
-- =============================================================================

-- 1. Allineamento S37: Tabella user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    session_id text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gli utenti possono gestire la propria sessione" ON public.user_sessions;
CREATE POLICY "Gli utenti possono gestire la propria sessione" ON public.user_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 2. Allineamento S37: Tabella collaboratori_studio
CREATE TABLE IF NOT EXISTS public.collaboratori_studio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    amministratore_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_collaboratore text NOT NULL,
    utente_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    attivo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (amministratore_id, email_collaboratore)
);

ALTER TABLE public.collaboratori_studio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gli amministratori gestiscono i propri collaboratori" ON public.collaboratori_studio;
CREATE POLICY "Gli amministratori gestiscono i propri collaboratori" ON public.collaboratori_studio
    FOR ALL TO authenticated
    USING (amministratore_id = auth.uid())
    WITH CHECK (amministratore_id = auth.uid());

DROP POLICY IF EXISTS "I collaboratori vedono la propria associazione" ON public.collaboratori_studio;
CREATE POLICY "I collaboratori vedono la propria associazione" ON public.collaboratori_studio
    FOR SELECT TO authenticated
    USING (email_collaboratore = auth.email() OR utente_id = auth.uid());


-- 3. Allineamento S37: Tabella collaboratori_condomini
CREATE TABLE IF NOT EXISTS public.collaboratori_condomini (
    collaboratore_id uuid REFERENCES public.collaboratori_studio(id) ON DELETE CASCADE,
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE CASCADE,
    PRIMARY KEY (collaboratore_id, condominio_id)
);

ALTER TABLE public.collaboratori_condomini ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gli amministratori gestiscono le associazioni dei propri collaboratori" ON public.collaboratori_condomini;
CREATE POLICY "Gli amministratori gestiscono le associazioni dei propri collaboratori" ON public.collaboratori_condomini
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.collaboratori_studio cs
            WHERE cs.id = collaboratore_id
              AND cs.amministratore_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.collaboratori_studio cs
            WHERE cs.id = collaboratore_id
              AND cs.amministratore_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "I collaboratori possono leggere le proprie associazioni" ON public.collaboratori_condomini;
CREATE POLICY "I collaboratori possono leggere le proprie associazioni" ON public.collaboratori_condomini
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.collaboratori_studio cs
            WHERE cs.id = collaboratore_id
              AND (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
        )
    );


-- 4. Allineamento S37: Funzione RLS user_owns_condominio
CREATE OR REPLACE FUNCTION public.user_owns_condominio(condo_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.condomini c
    WHERE c.id = condo_id
    AND (
      c.amministratore_id = auth.uid()
      OR public.is_superadmin(auth.uid())
      -- Se l'utente è un collaboratore, ha accesso solo se c'è un'associazione esplicita in collaboratori_condomini
      OR c.amministratore_id IN (
         SELECT cs.amministratore_id 
         FROM public.collaboratori_studio cs
         JOIN public.collaboratori_condomini cc ON cc.collaboratore_id = cs.id
         WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
           AND cs.attivo = true
           AND cc.condominio_id = condo_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. S48: Aggiunta della colonna per l'alias email dell'amministratore
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inbound_email_prefix text UNIQUE;

-- Genera un alias di default basato sui primi 8 caratteri dell'UUID per i profili esistenti
UPDATE public.profiles 
SET inbound_email_prefix = substring(id::text from 1 for 8)
WHERE inbound_email_prefix IS NULL;


-- 6. S48: Creazione della tabella inbox_documenti
CREATE TABLE IF NOT EXISTS public.inbox_documenti (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    amministratore_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE SET NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    email_mittente text,
    email_oggetto text,
    data_ricezione timestamp with time zone DEFAULT timezone('utc'::text, now()),
    stato text NOT NULL DEFAULT 'nuovo' CHECK (stato IN ('nuovo', 'rilevato', 'da_smistare', 'inserito', 'scartato')),
    dati_estratti jsonb,
    spesa_id uuid REFERENCES public.spese(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inbox_documenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gli utenti leggono i propri inbox_documenti" ON public.inbox_documenti;
CREATE POLICY "Gli utenti leggono i propri inbox_documenti" 
ON public.inbox_documenti
FOR SELECT TO authenticated
USING (
    amministratore_id = auth.uid()
    OR amministratore_id IN (
        SELECT cs.amministratore_id 
        FROM public.collaboratori_studio cs
        WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
          AND cs.attivo = true
    )
);

DROP POLICY IF EXISTS "Gli utenti modificano i propri inbox_documenti" ON public.inbox_documenti;
CREATE POLICY "Gli utenti modificano i propri inbox_documenti" 
ON public.inbox_documenti
FOR ALL TO authenticated
USING (
    amministratore_id = auth.uid()
    OR amministratore_id IN (
        SELECT cs.amministratore_id 
        FROM public.collaboratori_studio cs
        WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
          AND cs.attivo = true
    )
)
WITH CHECK (
    amministratore_id = auth.uid()
    OR amministratore_id IN (
        SELECT cs.amministratore_id 
        FROM public.collaboratori_studio cs
        WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
          AND cs.attivo = true
    )
);


-- 7. Abilitazione realtime per tracciamento sessioni (se non già presente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'user_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
    END IF;
END $$;


-- Notifica ricaricamento dello schema PostgREST
NOTIFY pgrst, 'reload schema';
