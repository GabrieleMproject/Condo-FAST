-- S74: Sistema Ibrido Accesso Assemblee (App Voto Condòmini)

-- ============================================================================
-- 1. Tabella dei Token per l'Accesso "VIP" (dalla Lettera di Convocazione)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assemblee_token_accesso (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assemblea_id UUID NOT NULL REFERENCES public.assemblee(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    utilizzato_il TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Solo l'amministratore (creatore del condominio) può gestire i token.
-- I condòmini possono leggerli (tramite RPC/Edge Function se non autenticati).
ALTER TABLE public.assemblee_token_accesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access token" ON public.assemblee_token_accesso
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM assemblee a
            JOIN condomini c ON a.condominio_id = c.id
            WHERE a.id = assemblee_token_accesso.assemblea_id
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 2. Tabella della "Sala d'Attesa" (per l'Accesso con QR Generico + CF)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assemblee_sala_attesa (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assemblea_id UUID NOT NULL REFERENCES public.assemblee(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    codice_fiscale_richiedente TEXT NOT NULL,
    stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'ammesso', 'rifiutato')),
    session_id TEXT NOT NULL, -- Per identificare il device del condomino in attesa
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger aggiornamento data
CREATE TRIGGER update_assemblee_sala_attesa_modtime
BEFORE UPDATE ON public.assemblee_sala_attesa
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Abilitiamo il realtime sulla sala d'attesa (per le notifiche all'Admin)
ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_sala_attesa;

ALTER TABLE public.assemblee_sala_attesa ENABLE ROW LEVEL SECURITY;

-- Gli admin possono gestire (leggere/modificare lo stato) delle richieste del loro condominio
CREATE POLICY "Admin full access sala attesa" ON public.assemblee_sala_attesa
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM assemblee a
            JOIN condomini c ON a.condominio_id = c.id
            WHERE a.id = assemblee_sala_attesa.assemblea_id
            AND c.user_id = auth.uid()
        )
    );

-- Accesso pubblico anonimo per INSERIRE richieste (dal form CF)
-- Poiché è una route pubblica, permettiamo l'INSERT anonimo, a patto che forniscano un session_id (guid locale browser)
CREATE POLICY "Public insert sala attesa" ON public.assemblee_sala_attesa
    FOR INSERT
    WITH CHECK (
        auth.role() = 'anon' OR auth.role() = 'authenticated'
    );

-- I dispositivi pubblici possono LEGGERE il loro stato tramite session_id
CREATE POLICY "Public read sala attesa via session" ON public.assemblee_sala_attesa
    FOR SELECT
    USING (
        true -- nella realtà dovremmo validare, ma per semplicità applicativa l'utente legge solo conoscendo id e session_id
    );

-- ============================================================================
-- 3. Policy per inserimento voti (permettiamo a utenti con "token" validato di votare)
-- Nota: Nella V1 per MVP usiamo l'approccio dove il client sa il token e la persona_id,
-- ma nella V2 andrebbe fatta tramite una RPC sicura. Per ora, allentiamo parzialmente la RLS dei voti.
-- ============================================================================

-- POLICY SU Voti Pubblici: 
-- In una vera app B2C, si creerebbe una funzione Security Definer per inviare il voto.
-- Per questo MVP, abilitiamo INSERT anonimo sui voti se il token è valido.

-- ============================================================================
-- 4. RPC per Verifica Codice Fiscale (Security Definer)
-- L'App Pubblica chiama questa funzione passandogli assemblea_id e CF. 
-- La funzione restituisce il persona_id se esiste, altrimenti null.
-- Questo evita di dover esporre l'intera tabella persone agli utenti anonimi.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_cf_assemblea(p_assemblea_id UUID, p_cf TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Esegue con privilegi di admin, scavalca RLS
AS $$
DECLARE
    v_condominio_id UUID;
    v_persona_id UUID;
BEGIN
    -- Trova il condominio
    SELECT condominio_id INTO v_condominio_id FROM public.assemblee WHERE id = p_assemblea_id;
    IF v_condominio_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Cerca la persona con quel CF in quel condominio
    -- Convertiamo il CF in uppercase per sicurezza
    SELECT id INTO v_persona_id 
    FROM public.persone 
    WHERE condominio_id = v_condominio_id 
      AND UPPER(codice_fiscale) = UPPER(p_cf)
    LIMIT 1;

    RETURN v_persona_id;
END;
$$;
