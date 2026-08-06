-- ==========================================
-- S77: Marketplace Sponsor e Zero Commissioni
-- ==========================================

-- 1. Aggiungiamo la colonna invited_by per tracciare lo "Sponsor"
ALTER TABLE public.fornitori_partner 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Aggiorniamo la funzione di check per forzare commissione 0% se l'amministratore è lo sponsor
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

    -- LOGICA 1: Controllo SPONSOR
    -- Se l'amministratore che carica la fattura è colui che ha invitato il fornitore, 
    -- la commissione è ZERO su tutti i condomini.
    IF v_partner.invited_by = p_user_id THEN
        v_is_preesistente := true;
        v_commissione := 0.00;
        v_stato_comm := 'sponsor_esente';
    
    -- LOGICA 2: Controllo CLIENTE STORICO (Fallback per pre-esistenti non invitati direttamente)
    -- Se l'ultima fattura risale a oltre 12 mesi fa, il cliente viene considerato EX-CLIENTE RICONQUISTATO (commissione dovuta).
    ELSIF p_condominio_id IS NOT NULL AND EXISTS (
        SELECT 1 
        FROM public.fatture_fornitori f
        WHERE f.condominio_id = p_condominio_id
          AND (p_fattura_id IS NULL OR f.id <> p_fattura_id)
          AND (
            REGEXP_REPLACE(COALESCE(f.ai_dati_estratti->>'partita_iva_fornitore', ''), '\s+', '', 'g') = v_piva_clean
            OR f.fornitore ILIKE '%' || v_partner.ragione_sociale || '%'
          )
          AND f.data_fattura < v_partner.data_inizio_contratto
          AND f.data_fattura >= (v_partner.data_inizio_contratto - INTERVAL '12 months')
    ) THEN
        v_is_preesistente := true;
        v_commissione := 0.00;
        v_stato_comm := 'cliente_preesistente';
    ELSE
        -- Nessuna esenzione: commissione standard
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
        CASE 
            WHEN v_stato_comm = 'sponsor_esente' THEN 'Esenzione commissione (Fornitore invitato da questo Amministratore Sponsor)' 
            WHEN v_stato_comm = 'cliente_preesistente' THEN 'Cliente preesistente (Fattura antecedente a data contratto partner)' 
            ELSE NULL 
        END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_match_id;

    RETURN jsonb_build_object(
        'matched', true,
        'partner_id', v_partner.id,
        'ragione_sociale', v_partner.ragione_sociale,
        'commissione', v_commissione,
        'percentuale', v_partner.percentuale_commissione,
        'is_preesistente', v_is_preesistente,
        'is_sponsor', (v_partner.invited_by = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
