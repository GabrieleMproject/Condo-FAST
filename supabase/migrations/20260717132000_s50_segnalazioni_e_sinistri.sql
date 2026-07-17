-- supabase/migrations/20260717132000_s50_segnalazioni_e_sinistri.sql
CREATE TABLE public.segnalazioni_condominio (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    condominio_id uuid NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    unita_id uuid REFERENCES public.unita(id) ON DELETE SET NULL,
    persona_id uuid REFERENCES public.persone(id) ON DELETE SET NULL,
    titolo text NOT NULL,
    descrizione text NOT NULL,
    stato text NOT NULL DEFAULT 'nuovo' CHECK (stato IN ('nuovo', 'in_corso', 'risolto', 'chiuso')),
    tipo text NOT NULL DEFAULT 'manutenzione' CHECK (tipo IN ('manutenzione', 'sinistro')),
    inbox_documento_id uuid REFERENCES public.inbox_documenti(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    data_chiusura timestamptz
);

-- RLS
ALTER TABLE public.segnalazioni_condominio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori possono gestire le segnalazioni" ON public.segnalazioni_condominio
    FOR ALL TO authenticated
    USING (
        public.user_owns_condominio(condominio_id)
    );
