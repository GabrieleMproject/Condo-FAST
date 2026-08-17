-- Aggiunta campi separati per contatti studio nella tabella profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS studio_telefono text,
ADD COLUMN IF NOT EXISTS studio_email text,
ADD COLUMN IF NOT EXISTS studio_pec text;

-- Aggiunta campi impianto e fotovoltaico nella tabella condomini
ALTER TABLE public.condomini
ADD COLUMN IF NOT EXISTS impianto_termico text,
ADD COLUMN IF NOT EXISTS presenza_fotovoltaico boolean DEFAULT false;
