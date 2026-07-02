-- s24_esercizio_tipo.sql
-- Migrazione per aggiungere la colonna `tipo` alla tabella `esercizi`
-- per distinguere tra gestione ordinaria e gestione straordinaria.

ALTER TABLE public.esercizi ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'ordinario';

ALTER TABLE public.esercizi DROP CONSTRAINT IF EXISTS esercizi_tipo_check;

ALTER TABLE public.esercizi ADD CONSTRAINT esercizi_tipo_check 
  CHECK (tipo IN ('ordinario', 'straordinario'));

NOTIFY pgrst, 'reload schema';
