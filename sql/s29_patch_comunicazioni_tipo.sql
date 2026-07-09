-- sql/s29_patch_comunicazioni_tipo.sql
-- Aggiorna il vincolo CHECK della tabella comunicazioni per includere il tipo 'sollecito_cartaceo'

ALTER TABLE public.comunicazioni 
DROP CONSTRAINT IF EXISTS check_comunicazioni_tipo;

ALTER TABLE public.comunicazioni
ADD CONSTRAINT check_comunicazioni_tipo 
CHECK (tipo IN ('avviso', 'sollecito', 'generale', 'sollecito_cartaceo'));

COMMENT ON COLUMN public.comunicazioni.tipo IS 'Tipo di comunicazione (avviso, sollecito, generale, sollecito_cartaceo)';
