-- supabase/migrations/20260817124600_s79_sinistri_fornitori.sql

-- 1. Creazione tabella sinistri
CREATE TABLE IF NOT EXISTS public.sinistri (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    condominio_id uuid NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    codice_sinistro text,
    titolo text NOT NULL,
    descrizione text,
    stato text NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto', 'in gestione', 'chiuso', 'liquidato')),
    data_evento date,
    data_denuncia date,
    importo_stimato numeric DEFAULT 0,
    importo_liquidato numeric DEFAULT 0,
    franchigia numeric DEFAULT 0,
    unita_origine_id uuid REFERENCES public.unita(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.sinistri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Amministratori possono gestire i sinistri" ON public.sinistri
    FOR ALL TO authenticated
    USING (public.user_owns_condominio(condominio_id));


-- 2. Creazione tabella fornitori_partner
CREATE TABLE IF NOT EXISTS public.fornitori_partner (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ragione_sociale text NOT NULL,
    partita_iva text,
    provincia_esclusiva text,
    percentuale_commissione numeric DEFAULT 0,
    email text,
    telefono text,
    attivo boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.fornitori_partner ENABLE ROW LEVEL SECURITY;
-- I fornitori partner sono globali per l'app (non legati a un condominio)
-- Tutti gli amministratori autenticati possono vederli (SELECT)
CREATE POLICY "Amministratori possono leggere i partner" ON public.fornitori_partner
    FOR SELECT TO authenticated
    USING (true);


-- 3. Creazione tabella partner_match_log
CREATE TABLE IF NOT EXISTS public.partner_match_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id uuid REFERENCES public.fornitori_partner(id) ON DELETE CASCADE,
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE CASCADE,
    amministratore_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    stato_commissione text DEFAULT 'da_fatturare',
    fattura_id uuid, -- Non strettamente legato in FK per evitare problemi circolari
    importo numeric DEFAULT 0,
    numero_fattura text,
    data_fattura date,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.partner_match_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Amministratori possono gestire i match log" ON public.partner_match_log
    FOR ALL TO authenticated
    USING (public.user_owns_condominio(condominio_id));


-- 4. Creazione tabella richieste_preventivo
CREATE TABLE IF NOT EXISTS public.richieste_preventivo (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id uuid REFERENCES public.fornitori_partner(id) ON DELETE CASCADE,
    condominio_id uuid REFERENCES public.condomini(id) ON DELETE CASCADE,
    amministratore_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    stato text DEFAULT 'inviata',
    richiesta_testo text,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.richieste_preventivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Amministratori possono gestire le richieste preventivo" ON public.richieste_preventivo
    FOR ALL TO authenticated
    USING (public.user_owns_condominio(condominio_id));
