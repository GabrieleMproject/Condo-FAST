-- ============================================================================
-- S61: AUDIT LOGS IMMUTABILI E SOFT-DELETE PER NORMATIVA CONDOMINIALE (1130-bis)
-- ============================================================================

-- 1. TABELLA AUDIT LOGS IMMUTABILE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    condominio_id UUID REFERENCES public.condomini(id) ON DELETE CASCADE,
    azione TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'
    entita TEXT NOT NULL, -- 'spese', 'rate', 'movimenti_bancari', 'documenti', etc.
    entita_id UUID,
    dettagli JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT
);

-- RLS PER AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Lettura consentita solo agli amministratori del condominio o superadmin
CREATE POLICY "Gli amministratori vedono gli audit log del proprio condominio"
ON public.audit_logs
FOR SELECT
USING (
    user_owns_condominio(condominio_id) OR is_superadmin(auth.uid())
);

-- Inserimento consentito agli utenti autenticati per le proprie azioni
CREATE POLICY "Utenti autenticati creano log di audit"
ON public.audit_logs
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

-- NESSUNA POLICY FOR UPDATE / DELETE: La tabella audit_logs è immutabile da RLS!

-- 2. SUPPORTO SOFT-DELETE SU TABELLE CONTABILI E DOCUMENTALI
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spese' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.spese ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rate' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.rate ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movimenti_bancari' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.movimenti_bancari ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documenti_condominio' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.documenti_condominio ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

COMMENT ON TABLE public.audit_logs IS 'Registro storico immutabile delle modifiche e cancellazioni per la conformità contabile ex art. 1130-bis c.c.';
