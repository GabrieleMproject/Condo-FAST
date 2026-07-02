-- S24: Aggiunta delle colonne di date di validità occupazione per subentri
-- Esegui questo script nell'SQL Editor di Supabase.

-- Aggiunge le colonne data_inizio e data_fine alla tabella occupanti_unita
ALTER TABLE public.occupanti_unita 
  ADD COLUMN IF NOT EXISTS data_inizio DATE,
  ADD COLUMN IF NOT EXISTS data_fine DATE;

-- Commenti esplicativi per le colonne
COMMENT ON COLUMN public.occupanti_unita.data_inizio IS 'Data in cui l occupant subentra/inizia a possedere l unita';
COMMENT ON COLUMN public.occupanti_unita.data_fine IS 'Data in cui termina l occupazione/proprieta dell unita';
