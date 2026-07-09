-- sql/s29_partner_postale.sql
-- Aggiunge le colonne per la configurazione del partner postale opzionale nella tabella profiles

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS partner_postale_nome TEXT DEFAULT 'nessuno',
ADD COLUMN IF NOT EXISTS partner_postale_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS partner_postale_mittente_id TEXT DEFAULT NULL;

-- Verifica vincolo check per partner_postale_nome
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_partner_postale_nome;

ALTER TABLE public.profiles
ADD CONSTRAINT check_partner_postale_nome 
CHECK (partner_postale_nome IN ('nessuno', 'multidialogo_simulato', 'multidialogo'));

COMMENT ON COLUMN public.profiles.partner_postale_nome IS 'Partner postale opzionale scelto (nessuno, multidialogo_simulato, multidialogo)';
COMMENT ON COLUMN public.profiles.partner_postale_api_key IS 'Chiave API del partner postale';
COMMENT ON COLUMN public.profiles.partner_postale_mittente_id IS 'ID del mittente registrato sul portale del partner postale';
