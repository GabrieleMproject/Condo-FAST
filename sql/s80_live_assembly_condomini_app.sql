-- sql/s80_live_assembly_condomini_app.sql
-- Modulo Live Assembly Mode, Portale App Condòmini, Proposte OdG 365gg e Quorum Deliberativi

-- ============================================================================
-- 1. Tabella Proposte OdG dai Condòmini (Cassetto Proposte tutto l'anno)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assemblee_proposte_odg (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    condominio_id UUID NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    unita_id UUID REFERENCES public.unita(id) ON DELETE SET NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    categoria TEXT DEFAULT 'manutenzione', -- 'manutenzione', 'spese', 'regolamento', 'servizi', 'altro'
    priorita TEXT DEFAULT 'normale' CHECK (priorita IN ('bassa', 'normale', 'urgente')),
    stato TEXT DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'inserita_odg', 'archiviata')),
    assemblea_id UUID REFERENCES public.assemblee(id) ON DELETE SET NULL,
    odg_id UUID REFERENCES public.assemblee_odg(id) ON DELETE SET NULL,
    note_amministratore TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger per updated_at
CREATE OR REPLACE TRIGGER update_assemblee_proposte_odg_modtime
BEFORE UPDATE ON public.assemblee_proposte_odg
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================================
-- 2. Aggiornamento Tabella assemblee_odg (Quorum e Esito)
-- ============================================================================
ALTER TABLE public.assemblee_odg 
ADD COLUMN IF NOT EXISTS tipo_quorum TEXT DEFAULT 'ordinaria_maggioranza',
ADD COLUMN IF NOT EXISTS quorum_millesimi_richiesto NUMERIC(7,2) DEFAULT 333.33,
ADD COLUMN IF NOT EXISTS quorum_teste_richiesto TEXT DEFAULT 'maggioranza_presenti',
ADD COLUMN IF NOT EXISTS esito TEXT DEFAULT 'non_votato' CHECK (esito IN ('non_votato', 'approvato', 'respinto')),
ADD COLUMN IF NOT EXISTS proposta_id UUID REFERENCES public.assemblee_proposte_odg(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS totale_favorevoli_millesimi NUMERIC(7,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS totale_contrari_millesimi NUMERIC(7,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS totale_astenuti_millesimi NUMERIC(7,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS totale_favorevoli_teste INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS totale_contrari_teste INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS totale_astenuti_teste INTEGER DEFAULT 0;

-- ============================================================================
-- 3. Aggiornamento Tabella documenti_condominio (Visibilità App Condòmini)
-- ============================================================================
ALTER TABLE public.documenti_condominio
ADD COLUMN IF NOT EXISTS visibile_condomini BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS categoria_app TEXT DEFAULT 'altro';

-- ============================================================================
-- 4. Aggiornamento Tabella condomini (Codice App PIN 6 caratteri)
-- ============================================================================
ALTER TABLE public.condomini 
ADD COLUMN IF NOT EXISTS codice_app VARCHAR(8);

-- Popolamento codice_app dove nullo
UPDATE public.condomini
SET codice_app = UPPER(SUBSTRING(REPLACE(MD5(id::text || 'condo'), '-', '') FROM 1 FOR 6))
WHERE codice_app IS NULL;

-- ============================================================================
-- 5. Row Level Security (RLS) per Proposte OdG
-- ============================================================================
ALTER TABLE public.assemblee_proposte_odg ENABLE ROW LEVEL SECURITY;

-- Policy Admin (l'amministratore del condominio gestisce tutte le proposte)
CREATE POLICY "Admin full access proposte odg" ON public.assemblee_proposte_odg
    FOR ALL
    USING (
        public.user_owns_condominio(condominio_id)
    );

-- Policy Condòmino (il condomino può inserire e vedere le proprie proposte)
CREATE POLICY "Condomino read own proposte" ON public.assemblee_proposte_odg
    FOR SELECT
    USING (
        persona_id IN (SELECT id FROM public.persone WHERE user_id = auth.uid())
        OR condominio_id IN (SELECT public.get_my_condomini_ids())
    );

CREATE POLICY "Condomino insert own proposte" ON public.assemblee_proposte_odg
    FOR INSERT
    WITH CHECK (
        persona_id IN (SELECT id FROM public.persone WHERE user_id = auth.uid())
        AND condominio_id IN (SELECT public.get_my_condomini_ids())
    );

CREATE POLICY "Condomino update own proposte" ON public.assemblee_proposte_odg
    FOR UPDATE
    USING (
        persona_id IN (SELECT id FROM public.persone WHERE user_id = auth.uid())
        AND stato = 'in_attesa'
    );

-- ============================================================================
-- 6. RPC Auto-Matching Condòmino (Codice App Condominio + Codice Fiscale)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_condomino_app(p_codice_app TEXT, p_codice_fiscale TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_condominio RECORD;
    v_persona RECORD;
    v_aggiornati INT := 0;
BEGIN
    -- 1. Trova il condominio tramite codice_app (case-insensitive)
    SELECT id, nome, indirizzo, citta, iban 
    INTO v_condominio
    FROM public.condomini 
    WHERE UPPER(codice_app) = UPPER(TRIM(p_codice_app))
    LIMIT 1;

    IF v_condominio.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Codice Condominio non valido');
    END IF;

    -- 2. Cerca la persona con quel codice fiscale in quel condominio
    SELECT id, nome, cognome, codice_fiscale, email, user_id
    INTO v_persona
    FROM public.persone
    WHERE condominio_id = v_condominio.id
      AND UPPER(REPLACE(codice_fiscale, ' ', '')) = UPPER(REPLACE(TRIM(p_codice_fiscale), ' ', ''))
    LIMIT 1;

    IF v_persona.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nessuna anagrafica trovata con questo Codice Fiscale per il condominio indicato');
    END IF;

    -- 3. Collega user_id se l'utente è loggato in Supabase Auth
    IF auth.uid() IS NOT NULL THEN
        UPDATE public.persone 
        SET user_id = auth.uid()
        WHERE id = v_persona.id;
        GET DIAGNOSTICS v_aggiornati = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'condominio_id', v_condominio.id,
        'condominio_nome', v_condominio.nome,
        'persona_id', v_persona.id,
        'nome', v_persona.nome,
        'cognome', v_persona.cognome
    );
END;
$$;

-- ============================================================================
-- 7. Tabella Deleghe Digitali Assemblea (Art. 67 disp. att. c.c.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assemblee_deleghe (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assemblea_id UUID NOT NULL REFERENCES public.assemblee(id) ON DELETE CASCADE,
    condominio_id UUID NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    delegante_persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    delegante_unita_id UUID REFERENCES public.unita(id) ON DELETE SET NULL,
    delegato_persona_id UUID REFERENCES public.persone(id) ON DELETE SET NULL,
    codice_delega TEXT NOT NULL UNIQUE,
    istruzioni_voto TEXT,
    stato TEXT DEFAULT 'creata' CHECK (stato IN ('creata', 'riscattata', 'revocata')),
    riscattata_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RPC per riscatto immediato codice delega con verifica limiti art. 67 disp. att. c.c.
CREATE OR REPLACE FUNCTION public.riscatta_codice_delega(
    p_codice_delega TEXT,
    p_delegato_persona_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delega RECORD;
    v_delegante RECORD;
    v_unita RECORD;
BEGIN
    SELECT * INTO v_delega
    FROM public.assemblee_deleghe
    WHERE UPPER(TRIM(codice_delega)) = UPPER(TRIM(p_codice_delega))
      AND stato = 'creata'
    LIMIT 1;

    IF v_delega.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Codice delega non valido, già riscattato o revocato.');
    END IF;

    IF v_delega.delegante_persona_id = p_delegato_persona_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non puoi delegare te stesso.');
    END IF;

    -- Recupera dati delegante e millesimi
    SELECT nome, cognome INTO v_delegante FROM public.persone WHERE id = v_delega.delegante_persona_id;
    SELECT nome, millesimi_proprieta INTO v_unita FROM public.unita WHERE id = v_delega.delegante_unita_id;

    -- Riscatta la delega
    UPDATE public.assemblee_deleghe
    SET delegato_persona_id = p_delegato_persona_id,
        stato = 'riscattata',
        riscattata_at = now()
    WHERE id = v_delega.id;

    RETURN jsonb_build_object(
        'success', true,
        'delega_id', v_delega.id,
        'delegante_nome', v_delegante.nome || ' ' || v_delegante.cognome,
        'unita_nome', v_unita.nome,
        'millesimi', v_unita.millesimi_proprieta
    );
END;
$$;

-- ============================================================================
-- 8. Realtime Publication
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_proposte_odg;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_deleghe;
    END IF;
END $$;

