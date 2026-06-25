-- diagnostica.sql — ispezione READ-ONLY dello stato reale del DB.
-- SQL Editor di Supabase. Nessuna modifica ai dati.

-- 1) COLONNE delle tabelle chiave
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'condomini','unita','persone','occupanti_unita','esercizi',
    'rate','rate_unita','preventivi','preventivo_voci',
    'estratto_conto','fatture_fornitori','riconciliazioni','riconciliazioni_incassi',
    'millesimi_unita','tabelle_millesimali')
order by table_name, ordinal_position;

-- 2) RLS attiva?
select relname as tabella, relrowsecurity as rls_attiva
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 3) POLICY per tabella
select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- 4) FOREIGN KEYS (necessari per gli embed PostgREST)
select con.conrelid::regclass as tabella, con.conname as fk,
       att.attname as colonna, con.confrelid::regclass as riferisce_a
from pg_constraint con
join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
where con.contype = 'f' and con.connamespace = 'public'::regnamespace
order by tabella, fk;

-- 5) CHECK constraints (es. rate_unita.stato)
select conrelid::regclass as tabella, conname, pg_get_constraintdef(oid) as definizione
from pg_constraint
where contype = 'c' and connamespace = 'public'::regnamespace
order by tabella, conname;
