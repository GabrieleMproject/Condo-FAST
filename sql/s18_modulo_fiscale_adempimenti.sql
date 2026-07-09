-- sql/s18_modulo_fiscale_adempimenti.sql

-- 1. Estensione tabella fornitori
ALTER TABLE public.fornitori
ADD COLUMN IF NOT EXISTS regime_forfettario BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS codice_esclusione_cu VARCHAR(5) DEFAULT NULL;

-- 2. Estensione tabella fatture_fornitori
ALTER TABLE public.fatture_fornitori
ADD COLUMN IF NOT EXISTS imponibile_ritenuta NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS aliquota_ritenuta_percentuale NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS importo_ritenuta NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS codice_tributo_f24 VARCHAR(5) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ritenuta_pagata BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_pagamento DATE DEFAULT NULL;

-- 3. Tabella Deleghe F24
CREATE TABLE IF NOT EXISTS public.f24_deleghe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID REFERENCES public.condomini(id) ON DELETE CASCADE,
    amministratore_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    data_scadenza DATE NOT NULL,
    data_pagamento DATE DEFAULT NULL,
    stato VARCHAR(20) DEFAULT 'da_pagare' CHECK (stato IN ('da_pagare', 'pagato', 'annullato')),
    importo_totale NUMERIC(10,2) DEFAULT 0.00,
    quietanza_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Deleghe F24
ALTER TABLE public.f24_deleghe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_f24 ON public.f24_deleghe;
CREATE POLICY admin_manage_f24 ON public.f24_deleghe
    USING (amministratore_id = auth.uid())
    WITH CHECK (amministratore_id = auth.uid());

-- 4. Tabella Dettagli Tributi F24
CREATE TABLE IF NOT EXISTS public.f24_dettagli_tributi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    f24_id UUID REFERENCES public.f24_deleghe(id) ON DELETE CASCADE,
    codice_tributo VARCHAR(5) NOT NULL,
    anno_riferimento INTEGER NOT NULL,
    mese_riferimento INTEGER NOT NULL,
    importo NUMERIC(10,2) NOT NULL
);

-- RLS Dettagli Tributi
ALTER TABLE public.f24_dettagli_tributi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_f24_dettagli ON public.f24_dettagli_tributi;
CREATE POLICY admin_manage_f24_dettagli ON public.f24_dettagli_tributi
    USING (EXISTS (
        SELECT 1 FROM public.f24_deleghe d 
        WHERE d.id = f24_dettagli_tributi.f24_id AND d.amministratore_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.f24_deleghe d 
        WHERE d.id = f24_dettagli_tributi.f24_id AND d.amministratore_id = auth.uid()
    ));

-- 5. Tabella di Collegamento Ritenute / F24
CREATE TABLE IF NOT EXISTS public.abbinamenti_f24_fatture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    f24_id UUID REFERENCES public.f24_deleghe(id) ON DELETE CASCADE,
    fattura_id UUID REFERENCES public.fatture_fornitori(id) ON DELETE CASCADE,
    importo_ritenuta_abbinata NUMERIC(10,2) NOT NULL
);

-- RLS Abbinamenti
ALTER TABLE public.abbinamenti_f24_fatture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_abbinamenti_f24 ON public.abbinamenti_f24_fatture;
CREATE POLICY admin_manage_abbinamenti_f24 ON public.abbinamenti_f24_fatture
    USING (EXISTS (
        SELECT 1 FROM public.f24_deleghe d 
        WHERE d.id = abbinamenti_f24_fatture.f24_id AND d.amministratore_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.f24_deleghe d 
        WHERE d.id = abbinamenti_f24_fatture.f24_id AND d.amministratore_id = auth.uid()
    ));

-- 6. Trigger PL/pgSQL per gestione automatica ritenute e F24 cumulativi
CREATE OR REPLACE FUNCTION public.processa_ritenuta_pagamento()
RETURNS TRIGGER AS $$
DECLARE
    v_data_pag DATE;
    v_data_scad DATE;
    v_f24_id UUID;
    v_dettaglio_id UUID;
    v_mese INT;
    v_anno INT;
    v_abb_count INT;
    v_existing_f24_stato VARCHAR(20);
BEGIN
    -- Sincronizzazione per retrocompatibilità con ritenuta_acconto
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Sincronizza importo_ritenuta su ritenuta_acconto
        IF NEW.importo_ritenuta <> OLD.importo_ritenuta OR (OLD.importo_ritenuta IS NULL AND NEW.importo_ritenuta IS NOT NULL) THEN
            NEW.ritenuta_acconto := NEW.importo_ritenuta;
        ELSIF NEW.ritenuta_acconto <> OLD.ritenuta_acconto OR (OLD.ritenuta_acconto IS NULL AND NEW.ritenuta_acconto IS NOT NULL) THEN
            NEW.importo_ritenuta := NEW.ritenuta_acconto;
        END IF;
    END IF;

    -- Gestione dello storno / rimozione stato 'pagata'
    IF (TG_OP = 'UPDATE' AND OLD.stato = 'pagata' AND NEW.stato <> 'pagata') OR (TG_OP = 'DELETE' AND OLD.stato = 'pagata') THEN
        -- Troviamo se c'è un abbinamento F24 per questa fattura
        SELECT f24_id INTO v_f24_id FROM public.abbinamenti_f24_fatture WHERE fattura_id = OLD.id LIMIT 1;
        
        IF v_f24_id IS NOT NULL THEN
            -- Controlliamo se la delega F24 è già stata pagata
            SELECT stato INTO v_existing_f24_stato FROM public.f24_deleghe WHERE id = v_f24_id;
            
            IF v_existing_f24_stato = 'pagato' THEN
                RAISE EXCEPTION 'Impossibile stornare la fattura: la ritenuta è già stata inserita in un modello F24 liquidato (pagato).';
            END IF;

            -- Rimuoviamo l'abbinamento
            DELETE FROM public.abbinamenti_f24_fatture WHERE fattura_id = OLD.id;
            
            -- Sottraiamo l'importo dal dettaglio tributo
            UPDATE public.f24_dettagli_tributi
            SET importo = importo - OLD.importo_ritenuta
            WHERE f24_id = v_f24_id 
              AND codice_tributo = OLD.codice_tributo_f24
              AND anno_riferimento = EXTRACT(YEAR FROM OLD.data_pagamento)::INT
              AND mese_riferimento = EXTRACT(MONTH FROM OLD.data_pagamento)::INT;
              
            -- Elimina i dettagli tributo vuoti (con importo <= 0)
            DELETE FROM public.f24_dettagli_tributi WHERE f24_id = v_f24_id AND importo <= 0;
            
            -- Ricalcola totale delega F24
            UPDATE public.f24_deleghe
            SET importo_totale = COALESCE((SELECT SUM(importo) FROM public.f24_dettagli_tributi WHERE f24_id = v_f24_id), 0.00)
            WHERE id = v_f24_id;
            
            -- Se la delega non ha più dettagli tributo o importo totale <= 0, la eliminiamo
            SELECT COUNT(*) INTO v_abb_count FROM public.f24_dettagli_tributi WHERE f24_id = v_f24_id;
            IF v_abb_count = 0 THEN
                DELETE FROM public.f24_deleghe WHERE id = v_f24_id;
            END IF;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            NEW.ritenuta_pagata := false;
        END IF;
    END IF;

    -- Gestione del pagamento della fattura
    IF (TG_OP = 'INSERT' AND NEW.stato = 'pagata') OR (TG_OP = 'UPDATE' AND OLD.stato <> 'pagata' AND NEW.stato = 'pagata') THEN
        IF NEW.importo_ritenuta > 0 AND NEW.codice_tributo_f24 IS NOT NULL THEN
            -- Se data_pagamento è null, impostala alla data corrente
            v_data_pag := COALESCE(NEW.data_pagamento, CURRENT_DATE);
            IF NEW.data_pagamento IS NULL THEN
                NEW.data_pagamento := v_data_pag;
            END IF;

            -- Calcoliamo la scadenza dell'F24: il 16 del mese successivo
            v_data_scad := (date_trunc('month', v_data_pag) + interval '1 month' + interval '15 days')::DATE;
            v_mese := EXTRACT(MONTH FROM v_data_pag)::INT;
            v_anno := EXTRACT(YEAR FROM v_data_pag)::INT;

            -- Cerca se esiste già un F24 per quel condominio con la stessa data di scadenza in stato 'da_pagare'
            SELECT id INTO v_f24_id 
            FROM public.f24_deleghe 
            WHERE condominio_id = NEW.condominio_id 
              AND data_scadenza = v_data_scad 
              AND stato = 'da_pagare'
            LIMIT 1;

            -- Se non esiste, lo creiamo
            IF v_f24_id IS NULL THEN
                INSERT INTO public.f24_deleghe (condominio_id, amministratore_id, data_scadenza, stato, importo_totale)
                VALUES (NEW.condominio_id, NEW.user_id, v_data_scad, 'da_pagare', 0.00)
                RETURNING id INTO v_f24_id;
            END IF;

            -- Verifichiamo se esiste già la riga di dettaglio tributo per questo F24
            SELECT id INTO v_dettaglio_id
            FROM public.f24_dettagli_tributi
            WHERE f24_id = v_f24_id 
              AND codice_tributo = NEW.codice_tributo_f24
              AND anno_riferimento = v_anno
              AND mese_riferimento = v_mese
            LIMIT 1;

            IF v_dettaglio_id IS NULL THEN
                -- Nuovo dettaglio tributo
                INSERT INTO public.f24_dettagli_tributi (f24_id, codice_tributo, anno_riferimento, mese_riferimento, importo)
                VALUES (v_f24_id, NEW.codice_tributo_f24, v_anno, v_mese, NEW.importo_ritenuta);
            ELSE
                -- Sommiamo al dettaglio tributo esistente
                UPDATE public.f24_dettagli_tributi
                SET importo = importo + NEW.importo_ritenuta
                WHERE id = v_dettaglio_id;
            END IF;

            -- Creazione abbinamento molti-a-uno
            INSERT INTO public.abbinamenti_f24_fatture (f24_id, fattura_id, importo_ritenuta_abbinata)
            VALUES (v_f24_id, NEW.id, NEW.importo_ritenuta);

            -- Ricalcoliamo il totale dell'F24
            UPDATE public.f24_deleghe
            SET importo_totale = COALESCE((SELECT SUM(importo) FROM public.f24_dettagli_tributi WHERE f24_id = v_f24_id), 0.00)
            WHERE id = v_f24_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Collegamento Trigger a fatture_fornitori
DROP TRIGGER IF EXISTS trigger_ritenuta_pagamento ON public.fatture_fornitori;
CREATE TRIGGER trigger_ritenuta_pagamento
BEFORE INSERT OR UPDATE OF stato, data_pagamento, importo_ritenuta, ritenuta_acconto
ON public.fatture_fornitori
FOR EACH ROW
EXECUTE FUNCTION public.processa_ritenuta_pagamento();

-- Trigger ausiliario per la rimozione
DROP TRIGGER IF EXISTS trigger_ritenuta_cancellazione ON public.fatture_fornitori;
CREATE TRIGGER trigger_ritenuta_cancellazione
BEFORE DELETE
ON public.fatture_fornitori
FOR EACH ROW
EXECUTE FUNCTION public.processa_ritenuta_pagamento();
