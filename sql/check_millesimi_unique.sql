-- S24: Verifica vincolo UNIQUE su millesimi_unita (tabella_id, unita_id)
-- Eseguire in Supabase SQL Editor (read-only)

-- 1. Verifica esistenza del vincolo UNIQUE
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'millesimi_unita'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, kcu.column_name;

-- 2. Verifica indici sulla tabella
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'millesimi_unita'
  AND schemaname = 'public';

-- 3. Se manca il vincolo UNIQUE, crearlo con:
-- ALTER TABLE public.millesimi_unita
--   ADD CONSTRAINT millesimi_unita_tabella_id_unita_id_key
--   UNIQUE (tabella_id, unita_id);
