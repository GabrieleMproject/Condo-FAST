-- sql/s51_open_banking.sql
-- Creazione tabella per le connessioni bancarie (Open Banking PSD2)

CREATE TABLE IF NOT EXISTS public.bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    institution_id TEXT NOT NULL, -- Es. 'SANDBOXFINANCE_SFIN0000'
    institution_name TEXT, -- Nome della banca
    requisition_id TEXT, -- ID della richiesta su GoCardless
    account_id TEXT, -- ID del conto bancario finale
    iban TEXT, -- IBAN associato al conto
    status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'LINKED', 'EXPIRED', 'ERROR'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori possono gestire le proprie bank_connections"
    ON public.bank_connections
    FOR ALL
    USING (public.user_owns_condominio(condominio_id))
    WITH CHECK (public.user_owns_condominio(condominio_id));

-- Aggiornamento estratto_conto per supportare i dati bancari strutturati
ALTER TABLE public.estratto_conto
ADD COLUMN IF NOT EXISTS metodo_importazione VARCHAR(50) DEFAULT 'pdf_ai';

-- Aggiungo identificatore transazione bancaria per evitare duplicati durante i sync ripetuti
ALTER TABLE public.estratto_conto
ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT UNIQUE;
