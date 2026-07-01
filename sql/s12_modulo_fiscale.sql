-- sql/s12_modulo_fiscale.sql

CREATE TABLE IF NOT EXISTS public.fornitori (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    ragione_sociale text NOT NULL,
    partita_iva text,
    codice_fiscale text,
    indirizzo text,
    citta text,
    cap text,
    provincia text,
    email text,
    telefono text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fornitori ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fornitori"
    ON public.fornitori
    FOR ALL
    USING (auth.uid() = user_id);

ALTER TABLE public.fatture_fornitori 
ADD COLUMN IF NOT EXISTS fornitore_id uuid REFERENCES public.fornitori(id) ON DELETE SET NULL;
