-- sql/s60_audit_log.sql
-- Tabella di registro di sicurezza inalterabile per la tracciabilità delle operazioni sensibili (art. 1130-bis c.c.)

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID REFERENCES public.condomini(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    azione TEXT NOT NULL,          -- es. 'MODIFICA_IBAN', 'CHIUSURA_ESERCIZIO', 'STORNO_SPESA', 'MODIFICA_MILLESIMI'
    entita TEXT NOT NULL,         -- es. 'condomini', 'esercizi', 'spese', 'tabelle_millesimali'
    id_entita TEXT,
    dettagli JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Abilita RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policy RLS: L'amministratore proprietario o superadmin può consultare i propri log
CREATE POLICY "audit_log_select_policy" ON public.audit_log
    FOR SELECT USING (
        user_id = auth.uid() OR
        (condominio_id IS NOT NULL AND user_owns_condominio(condominio_id)) OR
        is_superadmin(auth.uid())
    );

-- Policy RLS: Inserimento consentito all'utente autenticato
CREATE POLICY "audit_log_insert_policy" ON public.audit_log
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- Indici per ricerca rapida per condominio e data
CREATE INDEX IF NOT EXISTS idx_audit_log_condominio ON public.audit_log(condominio_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
