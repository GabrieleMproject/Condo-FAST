-- S42 — Piani fuori terra, piani interrati e dicitura Box
-- Script di migrazione per la tabella condomini

ALTER TABLE public.condomini 
ADD COLUMN IF NOT EXISTS num_piani_fuori_terra integer,
ADD COLUMN IF NOT EXISTS num_piani_interrati integer;

-- Migrazione dati storici: imposta num_piani_fuori_terra con il valore esistente di num_piani dove presente
UPDATE public.condomini 
SET num_piani_fuori_terra = num_piani 
WHERE num_piani_fuori_terra IS NULL AND num_piani IS NOT NULL;
