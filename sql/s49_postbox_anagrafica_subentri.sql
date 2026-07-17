-- =============================================================================
-- S49 — POSTBOX ANAGRAFICA, SUBENTRI E COMUNICAZIONI RICEVUTE
-- =============================================================================

-- 1. Modifica colonne file_path e file_name per consentire valori NULL (email solo testo)
ALTER TABLE public.inbox_documenti ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE public.inbox_documenti ALTER COLUMN file_name DROP NOT NULL;

-- 2. Aggiunta colonna tipo per distinguere spese, subentri e messaggi
ALTER TABLE public.inbox_documenti ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'spesa' CHECK (tipo IN ('spesa', 'subentro', 'messaggio'));

-- 3. Aggiunta colonne per il corpo dell'email e la tracciabilità delle letture
ALTER TABLE public.inbox_documenti ADD COLUMN IF NOT EXISTS email_corpo text;
ALTER TABLE public.inbox_documenti ADD COLUMN IF NOT EXISTS letta_il timestamp with time zone;

-- 4. Aggiornamento del check constraint dello stato per supportare 'elaborato' e 'conguagliato'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.inbox_documenti'::regclass 
          AND contype = 'c' 
          AND conname LIKE '%stato%'
    LOOP
        EXECUTE 'ALTER TABLE public.inbox_documenti DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.inbox_documenti ADD CONSTRAINT inbox_documenti_stato_check 
    CHECK (stato IN ('nuovo', 'rilevato', 'da_smistare', 'inserito', 'elaborato', 'conguagliato', 'scartato'));

-- 5. Creazione della tabella subentri_contabilizzazione per la gestione differita della Fase B
CREATE TABLE IF NOT EXISTS public.subentri_contabilizzazione (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_documento_id uuid REFERENCES public.inbox_documenti(id) ON DELETE CASCADE,
    unita_id uuid NOT NULL REFERENCES public.unita(id) ON DELETE CASCADE,
    persona_uscente_id uuid REFERENCES public.persone(id) ON DELETE SET NULL,
    persona_entrante_id uuid NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    data_subentro date NOT NULL,
    stato_contabile text NOT NULL DEFAULT 'in_attesa' CHECK (stato_contabile IN ('in_attesa', 'completato', 'bypassato')),
    saldo_conguaglio numeric(10,2) DEFAULT 0.00,
    accollato_a_entrante boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Abilitazione RLS per subentri_contabilizzazione
ALTER TABLE public.subentri_contabilizzazione ENABLE ROW LEVEL SECURITY;

-- Policy per subentri_contabilizzazione
DROP POLICY IF EXISTS "Gli utenti gestiscono i propri subentri" ON public.subentri_contabilizzazione;
CREATE POLICY "Gli utenti gestiscono i propri subentri" 
ON public.subentri_contabilizzazione
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.unita u
        WHERE u.id = unita_id
          AND public.user_owns_condominio(u.condominio_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.unita u
        WHERE u.id = unita_id
          AND public.user_owns_condominio(u.condominio_id)
    )
);

-- Notifica ricaricamento schema PostgREST
NOTIFY pgrst, 'reload schema';
