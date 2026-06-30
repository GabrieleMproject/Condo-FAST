-- =============================================================================
-- SEED E2E CONSUNTIVO — Dati realistici per collaudo
-- =============================================================================
-- Da eseguire nell'SQL Editor di Supabase.
--
-- Crea un condominio "CONDOMINIO VIA ROMA 10" con dati sufficienti per testare
-- TUTTE le sezioni del consuntivo (A→E + confronto preventivo + quadratura cassa).
--
-- PREREQUISITO: sostituire <ADMIN_UUID> con il tuo auth.uid().
-- Per trovarlo: SELECT id FROM auth.users LIMIT 1;
-- oppure guarda il valore nella console browser (F12 → supabase.auth.getUser()).
-- =============================================================================

-- ━━━ 0) PARAMETRI (MODIFICA QUI) ━━━
DO $$
DECLARE
  v_admin_id     uuid := 'ef3c27d1-75a1-452f-9e67-35a14d2ae74a';

  -- ID generati automaticamente
  v_condo_id     uuid;
  v_es_id        uuid;
  v_prev_id      uuid;
  v_tab_mill_id  uuid;
  v_u1           uuid;  -- Unità 1 (App. A1)
  v_u2           uuid;  -- Unità 2 (App. A2)
  v_u3           uuid;  -- Unità 3 (App. B1)
  v_u4           uuid;  -- Unità 4 (App. B2)
  v_p1           uuid;  -- Persona 1
  v_p2           uuid;  -- Persona 2
  v_p3           uuid;  -- Persona 3
  v_p4           uuid;  -- Persona 4
  v_rata1        uuid;  -- Rata Q1
  v_rata2        uuid;  -- Rata Q2
  v_rata3        uuid;  -- Rata Q3
  v_rata4        uuid;  -- Rata Q4
  v_spesa1       uuid;  -- Spesa assicurazione
  v_spesa2       uuid;  -- Spesa utenze
  v_spesa3       uuid;  -- Spesa manutenzione
  v_spesa4       uuid;  -- Spesa amministrazione
  v_spesa5       uuid;  -- Spesa straordinaria
  v_pv1          uuid;  -- Voce preventivo 1
  v_pv2          uuid;  -- Voce preventivo 2
  v_pv3          uuid;  -- Voce preventivo 3
  v_pv4          uuid;  -- Voce preventivo 4
  v_pv5          uuid;  -- Voce preventivo 5
  v_ec1          uuid;  -- Movimento EC 1
  v_ec2          uuid;  -- Movimento EC 2
  v_ec3          uuid;  -- Movimento EC 3
  v_ec4          uuid;  -- Movimento EC 4
  v_ec5          uuid;  -- Movimento EC 5
  v_ec6          uuid;  -- Movimento EC 6
  v_ec7          uuid;  -- Movimento EC 7
  v_ec8          uuid;  -- Movimento EC 8
  v_fat1         uuid;  -- Fattura 1
  v_fat2         uuid;  -- Fattura 2
  v_fat3         uuid;  -- Fattura 3 (con ritenuta)
BEGIN

-- ━━━ 1) CONDOMINIO ━━━
INSERT INTO condomini (id, nome, indirizzo, civico, citta, cap, provincia, codice_fiscale, amministratore_id, created_at)
VALUES (gen_random_uuid(), 'CONDOMINIO VIA ROMA 10', 'Via Roma', '10', 'Milano', '20121', 'MI', '12345678901', v_admin_id, now())
RETURNING id INTO v_condo_id;

-- ━━━ 2) TABELLA MILLESIMALE ━━━
INSERT INTO tabelle_millesimali (id, condominio_id, nome, created_at)
VALUES (gen_random_uuid(), v_condo_id, 'Proprietà generale', now())
RETURNING id INTO v_tab_mill_id;

-- ━━━ 3) UNITÀ (4 appartamenti) ━━━
INSERT INTO unita (id, condominio_id, numero, tipo, scala, piano, mq, created_at)
VALUES
  (gen_random_uuid(), v_condo_id, 'A1', 'appartamento', 'A', 1, 75, now()),
  (gen_random_uuid(), v_condo_id, 'A2', 'appartamento', 'A', 1, 90, now()),
  (gen_random_uuid(), v_condo_id, 'B1', 'appartamento', 'B', 2, 80, now()),
  (gen_random_uuid(), v_condo_id, 'B2', 'appartamento', 'B', 2, 105, now());

SELECT id INTO v_u1 FROM unita WHERE condominio_id = v_condo_id AND numero = 'A1';
SELECT id INTO v_u2 FROM unita WHERE condominio_id = v_condo_id AND numero = 'A2';
SELECT id INTO v_u3 FROM unita WHERE condominio_id = v_condo_id AND numero = 'B1';
SELECT id INTO v_u4 FROM unita WHERE condominio_id = v_condo_id AND numero = 'B2';

-- ━━━ 4) MILLESIMI (totale = 1000) ━━━
INSERT INTO millesimi_unita (id, tabella_id, unita_id, valore)
VALUES
  (gen_random_uuid(), v_tab_mill_id, v_u1, 215),   -- A1: 215/1000
  (gen_random_uuid(), v_tab_mill_id, v_u2, 260),   -- A2: 260/1000
  (gen_random_uuid(), v_tab_mill_id, v_u3, 230),   -- B1: 230/1000
  (gen_random_uuid(), v_tab_mill_id, v_u4, 295);   -- B2: 295/1000
  -- Totale: 215 + 260 + 230 + 295 = 1000

-- ━━━ 5) PERSONE + OCCUPANTI ━━━
INSERT INTO persone (id, nome, cognome, codice_fiscale, email, telefono, user_id, created_at)
VALUES
  (gen_random_uuid(), 'Marco',    'Bianchi',  'BNCMRC80A01F205X', 'marco.bianchi@email.it',  '3331111111', v_admin_id, now()),
  (gen_random_uuid(), 'Anna',     'Verdi',    'VRDNNA85B41F205Y', 'anna.verdi@email.it',     '3332222222', v_admin_id, now()),
  (gen_random_uuid(), 'Giuseppe', 'Russo',    'RSSGPP70C01F205Z', 'giuseppe.russo@email.it', '3333333333', v_admin_id, now()),
  (gen_random_uuid(), 'Paola',    'Ferrari',  'FRRPLA75D41F205W', 'paola.ferrari@email.it',  '3334444444', v_admin_id, now());

SELECT id INTO v_p1 FROM persone WHERE cognome = 'Bianchi' AND user_id = v_admin_id ORDER BY created_at DESC LIMIT 1;
SELECT id INTO v_p2 FROM persone WHERE cognome = 'Verdi'   AND user_id = v_admin_id ORDER BY created_at DESC LIMIT 1;
SELECT id INTO v_p3 FROM persone WHERE cognome = 'Russo'   AND user_id = v_admin_id ORDER BY created_at DESC LIMIT 1;
SELECT id INTO v_p4 FROM persone WHERE cognome = 'Ferrari' AND user_id = v_admin_id ORDER BY created_at DESC LIMIT 1;

INSERT INTO occupanti_unita (id, unita_id, persona_id, ruolo, attivo, created_at)
VALUES
  (gen_random_uuid(), v_u1, v_p1, 'proprietario', true, now()),
  (gen_random_uuid(), v_u2, v_p2, 'proprietario', true, now()),
  (gen_random_uuid(), v_u3, v_p3, 'proprietario', true, now()),
  (gen_random_uuid(), v_u4, v_p4, 'proprietario', true, now());

-- ━━━ 6) ESERCIZIO 2026 (anno solare) ━━━
INSERT INTO esercizi (id, condominio_id, anno, data_inizio, data_fine, stato, saldo_iniziale_cassa, created_at)
VALUES (gen_random_uuid(), v_condo_id, 2026, '2026-01-01', '2026-12-31', 'aperto', 2500.00, now())
RETURNING id INTO v_es_id;

-- ━━━ 7) SALDI INIZIALI PER UNITÀ ━━━
-- Simulano il riporto dall'anno precedente
INSERT INTO saldi_iniziali_unita (id, esercizio_id, unita_id, condominio_id, saldo, note)
VALUES
  (gen_random_uuid(), v_es_id, v_u1, v_condo_id,  150.00, 'Credito da esercizio 2025'),
  (gen_random_uuid(), v_es_id, v_u2, v_condo_id, -200.00, 'Debito da esercizio 2025'),
  (gen_random_uuid(), v_es_id, v_u3, v_condo_id,   50.00, 'Credito da esercizio 2025'),
  (gen_random_uuid(), v_es_id, v_u4, v_condo_id,    0.00, 'In pari');

-- ━━━ 8) PREVENTIVO (totale €24.000) ━━━
INSERT INTO preventivi (id, condominio_id, esercizio_id, stato, totale)
VALUES (gen_random_uuid(), v_condo_id, v_es_id, 'approvato', 24000)
RETURNING id INTO v_prev_id;

INSERT INTO preventivo_voci (id, preventivo_id, descrizione, categoria, importo, criterio, tabella_millesimale_id, ordine)
VALUES
  (gen_random_uuid(), v_prev_id, 'Polizza globale fabbricati',      'assicurazione',  3200, 'millesimi', v_tab_mill_id, 1),
  (gen_random_uuid(), v_prev_id, 'Energia elettrica + acqua',       'utenze',          4800, 'millesimi', v_tab_mill_id, 2),
  (gen_random_uuid(), v_prev_id, 'Manutenzione ordinaria',          'manutenzione',    6000, 'millesimi', v_tab_mill_id, 3),
  (gen_random_uuid(), v_prev_id, 'Compenso amministratore',         'altro',           4000, 'parti_uguali', null, 4),
  (gen_random_uuid(), v_prev_id, 'Fondo lavori straordinari',       'straordinaria',   6000, 'millesimi', v_tab_mill_id, 5);

-- ━━━ 9) RATE TRIMESTRALI (4 rate, ciascuna 25% del totale) ━━━
INSERT INTO rate (id, esercizio_id, condominio_id, numero_rata, data_scadenza, percentuale, descrizione, preventivo_id)
VALUES
  (gen_random_uuid(), v_es_id, v_condo_id, 1, '2026-03-31', 25, 'I trimestre 2026',   v_prev_id),
  (gen_random_uuid(), v_es_id, v_condo_id, 2, '2026-06-30', 25, 'II trimestre 2026',  v_prev_id),
  (gen_random_uuid(), v_es_id, v_condo_id, 3, '2026-09-30', 25, 'III trimestre 2026', v_prev_id),
  (gen_random_uuid(), v_es_id, v_condo_id, 4, '2026-12-31', 25, 'IV trimestre 2026',  v_prev_id);

SELECT id INTO v_rata1 FROM rate WHERE esercizio_id = v_es_id AND numero_rata = 1;
SELECT id INTO v_rata2 FROM rate WHERE esercizio_id = v_es_id AND numero_rata = 2;
SELECT id INTO v_rata3 FROM rate WHERE esercizio_id = v_es_id AND numero_rata = 3;
SELECT id INTO v_rata4 FROM rate WHERE esercizio_id = v_es_id AND numero_rata = 4;

-- ━━━ 10) RATE_UNITA (celle griglia) ━━━
-- Importi per unità per rata calcolati sui millesimi:
-- Quota trimestrale per unità = (preventivo * percentuale/100) * (millesimi_unita/1000)
-- A1(215): 24000*0.25*0.215 = 1290 per rata
-- A2(260): 24000*0.25*0.260 = 1560 per rata
-- B1(230): 24000*0.25*0.230 = 1380 per rata
-- B2(295): 24000*0.25*0.295 = 1770 per rata
-- Totale per rata: 6000. Totale annuo: 24000. ✓

-- Rata Q1 — tutti hanno pagato
INSERT INTO rate_unita (id, rata_id, unita_id, condominio_id, importo, importo_pagato, data_pagamento, stato)
VALUES
  (gen_random_uuid(), v_rata1, v_u1, v_condo_id, 1290, 1290, '2026-03-28', 'pagata'),
  (gen_random_uuid(), v_rata1, v_u2, v_condo_id, 1560, 1560, '2026-03-25', 'pagata'),
  (gen_random_uuid(), v_rata1, v_u3, v_condo_id, 1380, 1380, '2026-03-30', 'pagata'),
  (gen_random_uuid(), v_rata1, v_u4, v_condo_id, 1770, 1770, '2026-03-20', 'pagata');

-- Rata Q2 — tutti pagato tranne B2 (parziale)
INSERT INTO rate_unita (id, rata_id, unita_id, condominio_id, importo, importo_pagato, data_pagamento, stato)
VALUES
  (gen_random_uuid(), v_rata2, v_u1, v_condo_id, 1290, 1290, '2026-06-28', 'pagata'),
  (gen_random_uuid(), v_rata2, v_u2, v_condo_id, 1560, 1560, '2026-06-25', 'pagata'),
  (gen_random_uuid(), v_rata2, v_u3, v_condo_id, 1380, 1380, '2026-06-29', 'pagata'),
  (gen_random_uuid(), v_rata2, v_u4, v_condo_id, 1770, 1000, '2026-06-30', 'parziale');

-- Rata Q3 — A1 pagata, A2 pagata, B1 non pagata, B2 non pagata
INSERT INTO rate_unita (id, rata_id, unita_id, condominio_id, importo, importo_pagato, stato)
VALUES
  (gen_random_uuid(), v_rata3, v_u1, v_condo_id, 1290, 1290, 'pagata'),
  (gen_random_uuid(), v_rata3, v_u2, v_condo_id, 1560, 1560, 'pagata'),
  (gen_random_uuid(), v_rata3, v_u3, v_condo_id, 1380, 0,    'non_pagata'),
  (gen_random_uuid(), v_rata3, v_u4, v_condo_id, 1770, 0,    'non_pagata');

-- Rata Q4 — nessuno ha pagato (ancora in corso)
INSERT INTO rate_unita (id, rata_id, unita_id, condominio_id, importo, importo_pagato, stato)
VALUES
  (gen_random_uuid(), v_rata4, v_u1, v_condo_id, 1290, 0, 'non_pagata'),
  (gen_random_uuid(), v_rata4, v_u2, v_condo_id, 1560, 0, 'non_pagata'),
  (gen_random_uuid(), v_rata4, v_u3, v_condo_id, 1380, 0, 'non_pagata'),
  (gen_random_uuid(), v_rata4, v_u4, v_condo_id, 1770, 0, 'non_pagata');

-- ━━━ 11) SPESE (competenza — 5 spese, mix categorie e criteri) ━━━
INSERT INTO spese (id, esercizio_id, condominio_id, descrizione, importo, data_spesa, categoria, tipo_lavoro, criterio, tabella_millesimale_id, fornitore)
VALUES
  (gen_random_uuid(), v_es_id, v_condo_id, 'Polizza globale fabbricati 2026',        3000, '2026-02-15', 'assicurazione',  'ordinario',      'millesimi',    v_tab_mill_id, 'Assicurazioni Generali'),
  (gen_random_uuid(), v_es_id, v_condo_id, 'Energia elettrica gen-giu 2026',          2400, '2026-07-05', 'utenze',          'ordinario',      'millesimi',    v_tab_mill_id, 'Enel Energia'),
  (gen_random_uuid(), v_es_id, v_condo_id, 'Riparazione ascensore',                   1800, '2026-04-20', 'manutenzione',    'ordinario',      'millesimi',    v_tab_mill_id, 'Ascensori SpA'),
  (gen_random_uuid(), v_es_id, v_condo_id, 'Compenso amministratore 2026',            4000, '2026-06-30', 'altro',           'ordinario',      'quota_fissa',  null,          'Studio Maesani'),
  (gen_random_uuid(), v_es_id, v_condo_id, 'Rifacimento facciata (SAL 1)',             5500, '2026-08-15', 'manutenzione',    'straordinario',  'millesimi',    v_tab_mill_id, 'Edil Roma Srl');

SELECT id INTO v_spesa1 FROM spese WHERE condominio_id = v_condo_id AND descrizione LIKE 'Polizza%';
SELECT id INTO v_spesa2 FROM spese WHERE condominio_id = v_condo_id AND descrizione LIKE 'Energia%';
SELECT id INTO v_spesa3 FROM spese WHERE condominio_id = v_condo_id AND descrizione LIKE 'Riparazione%';
SELECT id INTO v_spesa4 FROM spese WHERE condominio_id = v_condo_id AND descrizione LIKE 'Compenso%';
SELECT id INTO v_spesa5 FROM spese WHERE condominio_id = v_condo_id AND descrizione LIKE 'Rifacimento%';

-- ━━━ 12) RIPARTIZIONI ━━━
-- Spesa 1 (assicurazione 3000€, millesimi): A1=645, A2=780, B1=690, B2=885
INSERT INTO ripartizioni (id, spesa_id, unita_id, importo, millesimi_usati, criterio_applicato)
VALUES
  (gen_random_uuid(), v_spesa1, v_u1, 645,  215, 'millesimi'),
  (gen_random_uuid(), v_spesa1, v_u2, 780,  260, 'millesimi'),
  (gen_random_uuid(), v_spesa1, v_u3, 690,  230, 'millesimi'),
  (gen_random_uuid(), v_spesa1, v_u4, 885,  295, 'millesimi');

-- Spesa 2 (utenze 2400€, millesimi): A1=516, A2=624, B1=552, B2=708
INSERT INTO ripartizioni (id, spesa_id, unita_id, importo, millesimi_usati, criterio_applicato)
VALUES
  (gen_random_uuid(), v_spesa2, v_u1, 516,  215, 'millesimi'),
  (gen_random_uuid(), v_spesa2, v_u2, 624,  260, 'millesimi'),
  (gen_random_uuid(), v_spesa2, v_u3, 552,  230, 'millesimi'),
  (gen_random_uuid(), v_spesa2, v_u4, 708,  295, 'millesimi');

-- Spesa 3 (manutenzione 1800€, millesimi): A1=387, A2=468, B1=414, B2=531
INSERT INTO ripartizioni (id, spesa_id, unita_id, importo, millesimi_usati, criterio_applicato)
VALUES
  (gen_random_uuid(), v_spesa3, v_u1, 387,  215, 'millesimi'),
  (gen_random_uuid(), v_spesa3, v_u2, 468,  260, 'millesimi'),
  (gen_random_uuid(), v_spesa3, v_u3, 414,  230, 'millesimi'),
  (gen_random_uuid(), v_spesa3, v_u4, 531,  295, 'millesimi');

-- Spesa 4 (compenso 4000€, quota fissa = 1000 cad.)
INSERT INTO ripartizioni (id, spesa_id, unita_id, importo, millesimi_usati, criterio_applicato)
VALUES
  (gen_random_uuid(), v_spesa4, v_u1, 1000, null, 'quota_fissa'),
  (gen_random_uuid(), v_spesa4, v_u2, 1000, null, 'quota_fissa'),
  (gen_random_uuid(), v_spesa4, v_u3, 1000, null, 'quota_fissa'),
  (gen_random_uuid(), v_spesa4, v_u4, 1000, null, 'quota_fissa');

-- Spesa 5 (straordinaria 5500€, millesimi): A1=1182.50, A2=1430, B1=1265, B2=1622.50
INSERT INTO ripartizioni (id, spesa_id, unita_id, importo, millesimi_usati, criterio_applicato)
VALUES
  (gen_random_uuid(), v_spesa5, v_u1, 1182.50, 215, 'millesimi'),
  (gen_random_uuid(), v_spesa5, v_u2, 1430,    260, 'millesimi'),
  (gen_random_uuid(), v_spesa5, v_u3, 1265,    230, 'millesimi'),
  (gen_random_uuid(), v_spesa5, v_u4, 1622.50, 295, 'millesimi');

-- ━━━ 13) ESTRATTO CONTO (movimenti bancari con `tipo` POPOLATO) ━━━
-- Entrate = versamenti condòmini (Q1 + Q2 + Q3 parziale)
-- Uscite  = pagamenti fornitori
INSERT INTO estratto_conto (id, condominio_id, data_movimento, causale, importo, tipo, pagante_rilevato, user_id)
VALUES
  -- Entrate (rate Q1: 6000 totale)
  (gen_random_uuid(), v_condo_id, '2026-03-28', 'Bonifico rata Q1 - Bianchi A1',  1290, 'entrata', 'Marco Bianchi',    v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-03-25', 'Bonifico rata Q1 - Verdi A2',    1560, 'entrata', 'Anna Verdi',       v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-03-30', 'Bonifico rata Q1 - Russo B1',    1380, 'entrata', 'Giuseppe Russo',   v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-03-20', 'Bonifico rata Q1 - Ferrari B2',  1770, 'entrata', 'Paola Ferrari',    v_admin_id),
  -- Entrate (rate Q2: 5230 totale, Ferrari parziale)
  (gen_random_uuid(), v_condo_id, '2026-06-28', 'Bonifico rata Q2 - Bianchi A1',  1290, 'entrata', 'Marco Bianchi',    v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-06-25', 'Bonifico rata Q2 - Verdi A2',    1560, 'entrata', 'Anna Verdi',       v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-06-29', 'Bonifico rata Q2 - Russo B1',    1380, 'entrata', 'Giuseppe Russo',   v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-06-30', 'Bonifico rata Q2 - Ferrari B2',  1000, 'entrata', 'Paola Ferrari',    v_admin_id),
  -- Entrate (rate Q3 parziale: solo A1 e A2)
  (gen_random_uuid(), v_condo_id, '2026-09-28', 'Bonifico rata Q3 - Bianchi A1',  1290, 'entrata', 'Marco Bianchi',    v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-09-25', 'Bonifico rata Q3 - Verdi A2',    1560, 'entrata', 'Anna Verdi',       v_admin_id),

  -- Uscite (pagamenti fornitori)
  (gen_random_uuid(), v_condo_id, '2026-02-20', 'Pagamento polizza Generali',     -3000, 'uscita', null, v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-07-10', 'Pagamento bolletta Enel',        -2400, 'uscita', null, v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-05-05', 'Pagamento Ascensori SpA',        -1800, 'uscita', null, v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-07-01', 'Compenso amministratore',        -4000, 'uscita', null, v_admin_id),
  (gen_random_uuid(), v_condo_id, '2026-09-01', 'Acconto Edil Roma facciata',     -5500, 'uscita', null, v_admin_id);

-- ━━━ 14) FATTURE FORNITORI (3 fatture, 1 con ritenuta) ━━━
INSERT INTO fatture_fornitori (id, condominio_id, user_id, spesa_id, fornitore, numero_fattura, data_fattura, importo_totale, importo_iva, importo_netto, stato, ritenuta_acconto)
VALUES
  (gen_random_uuid(), v_condo_id, v_admin_id, v_spesa1, 'Assicurazioni Generali', 'AG-2026/001', '2026-02-10', 3000, 541.67, 2458.33, 'pagata', null),
  (gen_random_uuid(), v_condo_id, v_admin_id, v_spesa3, 'Ascensori SpA',          'ASC-2026/15', '2026-04-15', 1800, 325.00, 1475.00, 'pagata', null),
  (gen_random_uuid(), v_condo_id, v_admin_id, v_spesa5, 'Edil Roma Srl',          'ER-2026/42',  '2026-08-10', 5500, 993.75, 4506.25, 'pagata', 900);
  -- Edil Roma ha ritenuta 900€, F24 NON caricato → badge "In attesa F24"

RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
RAISE NOTICE '✅ SEED COMPLETATO';
RAISE NOTICE 'Condominio: CONDOMINIO VIA ROMA 10';
RAISE NOTICE 'Condominio ID: %', v_condo_id;
RAISE NOTICE 'Esercizio 2026 ID: %', v_es_id;
RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
RAISE NOTICE '';
RAISE NOTICE '📊 VALORI ATTESI PER IL CONSUNTIVO:';
RAISE NOTICE '';
RAISE NOTICE '═══ SEZIONE B (Competenza) ═══';
RAISE NOTICE 'Assicurazione: €3.000 (ordinaria)';
RAISE NOTICE 'Utenze:        €2.400 (ordinaria)';
RAISE NOTICE 'Manutenzione:  €1.800 (ordinaria) + €5.500 (straordinaria) = €7.300';
RAISE NOTICE 'Altro:         €4.000 (ordinaria, quota fissa)';
RAISE NOTICE 'TOTALE ORD:    €11.200';
RAISE NOTICE 'TOTALE STRAORD: €5.500';
RAISE NOTICE 'TOTALE SPESE:  €16.700';
RAISE NOTICE '';
RAISE NOTICE '═══ SEZIONE C (Riparto per unità) ═══';
RAISE NOTICE 'A1 Bianchi:  dovuto=3730.50 versato=3870 saldoIniz=+150  conguaglio=+289.50 (credito)';
RAISE NOTICE 'A2 Verdi:    dovuto=4302.00 versato=4680 saldoIniz=-200  conguaglio=+178.00 (credito)';
RAISE NOTICE 'B1 Russo:    dovuto=3921.00 versato=2760 saldoIniz=+50   conguaglio=-1111.00 (debito)';
RAISE NOTICE 'B2 Ferrari:  dovuto=4746.50 versato=2770 saldoIniz=0     conguaglio=-1976.50 (debito)';
RAISE NOTICE '';
RAISE NOTICE '═══ SEZIONE D (Cassa) ═══';
RAISE NOTICE 'Saldo iniziale cassa: €2.500';
RAISE NOTICE 'Entrate (10 bonifici): €14.080';
RAISE NOTICE 'Uscite (5 pagamenti):  €16.700';
RAISE NOTICE 'Saldo finale cassa:    €-120 (2500 + 14080 - 16700)';
RAISE NOTICE 'Risultato competenza:  €-2.620 (14080 - 16700)';
RAISE NOTICE 'Variazione cassa:      €-2.620 (-120 - 2500)';
RAISE NOTICE 'Scarto quadratura:     €0 (perfetto!)';
RAISE NOTICE '';
RAISE NOTICE '═══ SEZIONE E (Fatture) ═══';
RAISE NOTICE '3 fatture, tutte pagate';
RAISE NOTICE '1 con ritenuta €900 SENZA F24 → badge "In attesa F24"';
RAISE NOTICE '';
RAISE NOTICE '═══ CONFRONTO PREVENTIVO ═══';
RAISE NOTICE 'Preventivo: €24.000 vs Consuntivo: €16.700 → Differenza: +€7.300';
RAISE NOTICE '(avanzo: si è speso meno del previsto)';

END $$;
