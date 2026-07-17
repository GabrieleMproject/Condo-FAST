-- =============================================================================
-- CONFIGURAZIONE STORAGE BUCKET 'inbox-ricezione' E RLS POLICIES
-- =============================================================================

-- 1. Inserimento del bucket privato
INSERT INTO storage.buckets (id, name, public)
VALUES ('inbox-ricezione', 'inbox-ricezione', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Politica SELECT (Lettura)
DROP POLICY IF EXISTS "Gli utenti leggono i propri file in inbox-ricezione" ON storage.objects;
CREATE POLICY "Gli utenti leggono i propri file in inbox-ricezione"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'inbox-ricezione'
    AND (
        (owner = auth.uid())
        OR (substring(name from '^([^/]+)/') = auth.uid()::text)
        OR (substring(name from '^([^/]+)/') IN (
            SELECT cs.amministratore_id::text 
            FROM public.collaboratori_studio cs
            WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
              AND cs.attivo = true
        ))
    )
);

-- 3. Politica INSERT (Caricamento)
DROP POLICY IF EXISTS "Gli utenti caricano i propri file in inbox-ricezione" ON storage.objects;
CREATE POLICY "Gli utenti caricano i propri file in inbox-ricezione"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'inbox-ricezione'
    AND (
        (substring(name from '^([^/]+)/') = auth.uid()::text)
        OR (substring(name from '^([^/]+)/') IN (
            SELECT cs.amministratore_id::text 
            FROM public.collaboratori_studio cs
            WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
              AND cs.attivo = true
        ))
    )
);

-- 4. Politica DELETE (Eliminazione)
DROP POLICY IF EXISTS "Gli utenti eliminano i propri file in inbox-ricezione" ON storage.objects;
CREATE POLICY "Gli utenti eliminano i propri file in inbox-ricezione"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'inbox-ricezione'
    AND (
        (substring(name from '^([^/]+)/') = auth.uid()::text)
        OR (substring(name from '^([^/]+)/') IN (
            SELECT cs.amministratore_id::text 
            FROM public.collaboratori_studio cs
            WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
              AND cs.attivo = true
        ))
    )
);
