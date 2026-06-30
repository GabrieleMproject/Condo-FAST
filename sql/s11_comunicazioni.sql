-- =============================================================================
-- TABELLA COMUNICAZIONI — Tracciamento invii email via Resend
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.comunicazioni (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE CASCADE,
    amministratore_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    destinatario_email text NOT NULL,
    destinatario_nome text,
    oggetto text NOT NULL,
    messaggio text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('avviso', 'sollecito', 'generale')),
    stato text NOT NULL DEFAULT 'inviata' CHECK (stato IN ('inviata', 'consegnata', 'fallita')),
    created_at timestamptz DEFAULT now()
);

-- Abilita RLS
ALTER TABLE public.comunicazioni ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: l'amministratore vede solo le suas comunicazioni
CREATE POLICY user_select_comunicazioni ON public.comunicazioni
    FOR SELECT TO authenticated
    USING (
        amministratore_id = auth.uid() OR
        (condominio_id IS NOT NULL AND user_owns_condominio(condominio_id))
    );

-- Policy INSERT: l'amministratore può inserire solo se stesso come amministratore_id
CREATE POLICY user_insert_comunicazioni ON public.comunicazioni
    FOR INSERT TO authenticated
    WITH CHECK (
        amministratore_id = auth.uid()
    );

-- Policy UPDATE/DELETE: solo l'amministratore proprietario della comunicazione può modificare/eliminare
CREATE POLICY user_update_delete_comunicazioni ON public.comunicazioni
    FOR ALL TO authenticated
    USING (
        amministratore_id = auth.uid()
    );
