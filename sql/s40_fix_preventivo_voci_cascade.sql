-- sql/s40_fix_preventivo_voci_cascade.sql
-- Risolve il blocco della cancellazione del condominio modificando la Foreign Key di preventivo_voci su tabelle_millesimali con ON DELETE CASCADE.

ALTER TABLE public.preventivo_voci 
DROP CONSTRAINT IF EXISTS preventivo_voci_tabella_millesimale_id_fkey;

ALTER TABLE public.preventivo_voci 
ADD CONSTRAINT preventivo_voci_tabella_millesimale_id_fkey 
FOREIGN KEY (tabella_millesimale_id) 
REFERENCES public.tabelle_millesimali(id) 
ON DELETE CASCADE;
