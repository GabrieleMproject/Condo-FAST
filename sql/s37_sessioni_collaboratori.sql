-- =============================================================================
-- S37 — SESSIONI CONCORRENTI E GESTIONE COLLABORATORI
-- =============================================================================

-- 1. Tabella delle sessioni attive per bloccare l'account sharing
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    session_id text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Abilitazione RLS su user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per user_sessions
DROP POLICY IF EXISTS "Gli utenti possono gestire la propria sessione" ON public.user_sessions;
CREATE POLICY "Gli utenti possono gestire la propria sessione" ON public.user_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 2. Tabella collaboratori per la multi-utenza dei piani superiori
CREATE TABLE IF NOT EXISTS public.collaboratori_studio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    amministratore_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_collaboratore text NOT NULL,
    utente_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    attivo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (amministratore_id, email_collaboratore)
);

-- Abilitazione RLS su collaboratori_studio
ALTER TABLE public.collaboratori_studio ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per collaboratori_studio
DROP POLICY IF EXISTS "Gli amministratori gestiscono i propri collaboratori" ON public.collaboratori_studio;
CREATE POLICY "Gli amministratori gestiscono i propri collaboratori" ON public.collaboratori_studio
    FOR ALL TO authenticated
    USING (amministratore_id = auth.uid())
    WITH CHECK (amministratore_id = auth.uid());

DROP POLICY IF EXISTS "I collaboratori vedono la propria associazione" ON public.collaboratori_studio;
CREATE POLICY "I collaboratori vedono la propria associazione" ON public.collaboratori_studio
    FOR SELECT TO authenticated
    USING (email_collaboratore = auth.email() OR utente_id = auth.uid());


-- 3. Aggiornamento funzione RLS user_owns_condominio per supportare i collaboratori
CREATE OR REPLACE FUNCTION public.user_owns_condominio(condo_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.condomini c
    WHERE c.id = condo_id
    AND (
      c.amministratore_id = auth.uid()
      OR public.is_superadmin(auth.uid())
      OR c.amministratore_id IN (
         SELECT cs.amministratore_id 
         FROM public.collaboratori_studio cs
         WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
           AND cs.attivo = true
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Abilitazione realtime per il tracciamento delle sessioni attive
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
