-- cleanup_test.sql — rimozione dati di test su RESIDENZA OASI.
-- OASI condominio_id = c9bccd13-7d03-4a6c-baa6-4420748760b1
-- esercizio test 2025 = 736fe475-1285-48a5-8978-82e9e655cdb9
-- PARTE A = ANTEPRIMA (lancia e controlla). PARTE B = DELETE (decommenta dopo aver verificato A).

-- ===== PARTE A: ANTEPRIMA =====
select 'estratto_conto' t, count(*) from estratto_conto where condominio_id = 'c9bccd13-7d03-4a6c-baa6-4420748760b1'
union all select 'riconciliazioni_incassi', count(*) from riconciliazioni_incassi where condominio_id = 'c9bccd13-7d03-4a6c-baa6-4420748760b1'
union all select 'rate (esercizio test)', count(*) from rate where esercizio_id = '736fe475-1285-48a5-8978-82e9e655cdb9'
union all select 'persone test', count(*) from persone where nome || ' ' || cognome in ('Mario Rossi','Laura Bianchi');

-- ===== PARTE B: DELETE (decommentare dopo aver controllato A) =====
-- begin;
--   delete from riconciliazioni_incassi where condominio_id = 'c9bccd13-7d03-4a6c-baa6-4420748760b1';
--   delete from estratto_conto         where condominio_id = 'c9bccd13-7d03-4a6c-baa6-4420748760b1';
--   delete from esercizi where id = '736fe475-1285-48a5-8978-82e9e655cdb9'; -- cascade su rate/rate_unita
--   -- occupanti/persone test: scegli in base a diagnostica
--   -- delete from occupanti_unita where persona_id in (select id from persone where nome||' '||cognome in ('Mario Rossi','Laura Bianchi'));
--   -- delete from persone where nome||' '||cognome in ('Mario Rossi','Laura Bianchi');
-- commit;
