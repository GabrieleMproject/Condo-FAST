-- ==========================================
-- S63: Fornitori Partner, Marketplace & Match Fatture
-- ==========================================

-- 1. Tabella Fornitori Partner Convenzionati
CREATE TABLE IF NOT EXISTS public.fornitori_partner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ragione_sociale TEXT NOT NULL,
    partita_iva TEXT UNIQUE NOT NULL,
    codice_fiscale TEXT,
    email TEXT,
    telefono TEXT,
    referente_nome TEXT,
    categoria TEXT NOT NULL DEFAULT 'manutenzione', -- idraulico, elettricista, spurghi, ascensori, pulizie, assicurazioni, energia, altro
    provincia_esclusiva VARCHAR(5) NOT NULL,       -- Sigla Provincia (es. 'MI', 'BG', 'RM')
    tipo_contratto TEXT NOT NULL DEFAULT 'pioneer_esclusivo', -- 'pioneer_esclusivo', 'multi_vendor', 'sospeso'
    data_inizio_contratto DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fine_contratto DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    quota_fissa_annuale NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    percentuale_commissione NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    finestra_attribuzione_mesi INTEGER NOT NULL DEFAULT 12,
    rating_soddisfazione NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    numero_recensioni INTEGER NOT NULL DEFAULT 0,
    note_contrattuali TEXT,
    attivo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per ricerche rapide per P.IVA, Provincia e Categoria
CREATE INDEX IF NOT EXISTS idx_fornitori_partner_piva ON public.fornitori_partner(partita_iva);
CREATE INDEX IF NOT EXISTS idx_fornitori_partner_provincia ON public.fornitori_partner(provincia_esclusiva);
CREATE INDEX IF NOT EXISTS idx_fornitori_partner_categoria ON public.fornitori_partner(categoria);

-- 2. Tabella Rendicontazione e Log Match Automatico Fatture
CREATE TABLE IF NOT EXISTS public.partner_match_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.fornitori_partner(id) ON DELETE CASCADE,
    fattura_id UUID REFERENCES public.fatture_fornitori(id) ON DELETE SET NULL,
    condominio_id UUID REFERENCES public.condomini(id) ON DELETE SET NULL,
    amministratore_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    partita_iva_rilevata TEXT NOT NULL,
    numero_fattura TEXT,
    data_fattura DATE,
    importo_fattura NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    percentuale_applicata NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    importo_commissione NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stato_commissione TEXT NOT NULL DEFAULT 'da_fatturare', -- 'da_fatturare', 'fatturato', 'saldato'
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_match_log_partner ON public.partner_match_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_match_log_fattura ON public.partner_match_log(fattura_id);

-- 3. Tabella Richieste Preventivo Amministratori -> Fornitori Partner
CREATE TABLE IF NOT EXISTS public.richieste_preventivo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID REFERENCES public.condomini(id) ON DELETE SET NULL,
    amministratore_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES public.fornitori_partner(id) ON DELETE SET NULL,
    categoria TEXT NOT NULL,
    provincia VARCHAR(5) NOT NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    stato TEXT NOT NULL DEFAULT 'inviata', -- 'inviata', 'in_lavorazione', 'preventivo_ricevuto', 'approvata', 'rifiutata'
    importo_preventivo NUMERIC(10,2),
    valutazione_amministratore INTEGER CHECK (valutazione_amministratore BETWEEN 1 AND 5),
    recensione_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_richieste_preventivo_admin ON public.richieste_preventivo(amministratore_id);
CREATE INDEX IF NOT EXISTS idx_richieste_preventivo_partner ON public.richieste_preventivo(partner_id);

-- 4. RLS Policies
ALTER TABLE public.fornitori_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_match_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.richieste_preventivo ENABLE ROW LEVEL SECURITY;

-- SuperAdmin Access su fornitori_partner
CREATE POLICY superadmin_all_fornitori_partner ON public.fornitori_partner
    FOR ALL
    TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- Gli utenti autenticati possono leggere i fornitori partner attivi
CREATE POLICY authenticated_read_fornitori_partner ON public.fornitori_partner
    FOR SELECT
    TO authenticated
    USING (attivo = true);

-- SuperAdmin Access su partner_match_log
CREATE POLICY superadmin_all_partner_match_log ON public.partner_match_log
    FOR ALL
    TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- Amministratore gestisce le proprie richieste preventivo
CREATE POLICY admin_manage_richieste_preventivo ON public.richieste_preventivo
    FOR ALL
    TO authenticated
    USING (amministratore_id = auth.uid() OR public.is_superadmin(auth.uid()))
    WITH CHECK (amministratore_id = auth.uid() OR public.is_superadmin(auth.uid()));

    -- 5. Funzione RPC per match automatico fattura
CREATE OR REPLACE FUNCTION public.check_invoice_partner_match(
    p_fattura_id UUID,
    p_piva TEXT,
    p_importo NUMERIC,
    p_data_fattura DATE,
    p_numero_fattura TEXT,
    p_condominio_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_partner RECORD;
    v_piva_clean TEXT;
    v_commissione NUMERIC(10,2);
    v_stato_comm TEXT;
    v_match_id UUID;
    v_is_preesistente BOOLEAN := false;
BEGIN
    v_piva_clean := REGEXP_REPLACE(p_piva, '\s+', '', 'g');
    IF v_piva_clean IS NULL OR v_piva_clean = '' THEN
        RETURN jsonb_build_object('matched', false, 'reason', 'partita_iva_vuota');
    END IF;

    -- Trova partner attivo con corrispondenza P.IVA e data validità contratto
    SELECT * INTO v_partner
    FROM public.fornitori_partner
    WHERE (REPLACE(partita_iva, ' ', '') = v_piva_clean OR REPLACE(codice_fiscale, ' ', '') = v_piva_clean)
      AND attivo = true
      AND (p_data_fattura IS NULL OR p_data_fattura BETWEEN data_inizio_contratto AND data_fine_contratto)
    LIMIT 1;

    IF v_partner.id IS NULL THEN
        RETURN jsonb_build_object('matched', false, 'reason', 'partner_non_trovato');
    END IF;

    -- Controllo se il condominio era già cliente del fornitore prima dell'inizio del contratto partner
    IF p_condominio_id IS NOT NULL AND EXISTS (
        SELECT 1 
        FROM public.fatture_fornitori f
        WHERE f.condominio_id = p_condominio_id
          AND f.id <> p_fattura_id
          AND (
            REGEXP_REPLACE(COALESCE(f.ai_dati_estratti->>'partita_iva_fornitore', ''), '\s+', '', 'g') = v_piva_clean
            OR f.fornitore ILIKE '%' || v_partner.ragione_sociale || '%'
          )
          AND f.data_fattura < v_partner.data_inizio_contratto
    ) THEN
        v_is_preesistente := true;
        v_commissione := 0.00;
        v_stato_comm := 'cliente_preesistente';
    ELSE
        v_commissione := ROUND((p_importo * v_partner.percentuale_commissione) / 100.0, 2);
        v_stato_comm := 'da_fatturare';
    END IF;

    -- Inserisci o aggiorna match log
    INSERT INTO public.partner_match_log (
        partner_id,
        fattura_id,
        condominio_id,
        amministratore_id,
        partita_iva_rilevata,
        numero_fattura,
        data_fattura,
        importo_fattura,
        percentuale_applicata,
        importo_commissione,
        stato_commissione,
        note
    ) VALUES (
        v_partner.id,
        p_fattura_id,
        p_condominio_id,
        p_user_id,
        v_piva_clean,
        p_numero_fattura,
        p_data_fattura,
        p_importo,
        v_partner.percentuale_commissione,
        v_commissione,
        v_stato_comm,
        CASE WHEN v_is_preesistente THEN 'Cliente preesistente (Fattura antecedente a data contratto partner)' ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_match_id;

    RETURN jsonb_build_object(
        'matched', true,
        'partner_id', v_partner.id,
        'ragione_sociale', v_partner.ragione_sociale,
        'commissione', v_commissione,
        'percentuale', v_partner.percentuale_commissione,
        'is_preesistente', v_is_preesistente
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
