-- =============================================================================
-- S37 — ASSOCIAZIONE COLLABORATORI AI CONDOMINI
-- =============================================================================

-- 1. Tabella di giunzione molti-a-molti per l'assegnazione dei condomini
CREATE TABLE IF NOT EXISTS public.collaboratori_condomini (
    collaboratore_id uuid REFERENCES public.collaboratori_studio(id) ON DELETE CASCADE,
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE CASCADE,
    PRIMARY KEY (collaboratore_id, condominio_id)
);

-- Abilitazione RLS su collaboratori_condomini
ALTER TABLE public.collaboratori_condomini ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per collaboratori_condomini
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


-- 2. Aggiornamento funzione RLS user_owns_condominio per restringere l'accesso del collaboratore
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
