-- =====================================================================
-- S9 — Consuntivo / Rendiconto annuale  (versione idempotente eseguita)
-- Decisioni:
--   D1     = 1A  (badge ritenuta/F24 DERIVATO in UI, niente CHECK su stato)
--   D2     = tutte e 5 le sezioni, pagina dedicata dentro il condominio
--   D2-bis = B   (saldi iniziali PER UNITA' + fondo cassa riportato)
--   D2-ter = A   (branding studio su profiles, riusabile)
--   D3     = criterio spese + 'manuale'
-- =====================================================================

-- D3 — criterio spese: aggiunge 'manuale'
ALTER TABLE spese DROP CONSTRAINT IF EXISTS spese_criterio_check;
ALTER TABLE spese ADD CONSTRAINT spese_criterio_check
  CHECK (criterio = ANY (ARRAY['millesimi','quota_fissa','mista','manuale']));

-- D1 — ritenuta d'acconto / F24 su fatture_fornitori (badge derivato in UI)
ALTER TABLE fatture_fornitori ADD COLUMN IF NOT EXISTS ritenuta_acconto numeric;     -- NULL = niente ritenuta
ALTER TABLE fatture_fornitori ADD COLUMN IF NOT EXISTS f24_url text;                 -- path quietanza in bucket 'fatture'
ALTER TABLE fatture_fornitori ADD COLUMN IF NOT EXISTS f24_caricato_at timestamptz;  -- audit

-- D2-bis — fondo cassa riportato (livello condominio)
ALTER TABLE esercizi ADD COLUMN IF NOT EXISTS saldo_iniziale_cassa numeric;

-- D2-bis — saldi iniziali per unità (chi era a credito/debito)
-- Convenzione: saldo > 0 = CREDITO del condòmino (il condominio gli deve)
--              saldo < 0 = DEBITO  del condòmino (deve al condominio)
CREATE TABLE IF NOT EXISTS saldi_iniziali_unita (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esercizio_id  uuid NOT NULL REFERENCES esercizi(id) ON DELETE CASCADE,
  unita_id      uuid NOT NULL REFERENCES unita(id)     ON DELETE CASCADE,
  condominio_id uuid NOT NULL REFERENCES condomini(id) ON DELETE CASCADE,
  saldo         numeric NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(esercizio_id, unita_id)
);

ALTER TABLE saldi_iniziali_unita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saldi own select" ON saldi_iniziali_unita;
DROP POLICY IF EXISTS "saldi own insert" ON saldi_iniziali_unita;
DROP POLICY IF EXISTS "saldi own update" ON saldi_iniziali_unita;
DROP POLICY IF EXISTS "saldi own delete" ON saldi_iniziali_unita;

CREATE POLICY "saldi own select" ON saldi_iniziali_unita
  FOR SELECT USING (user_owns_condominio(condominio_id));
CREATE POLICY "saldi own insert" ON saldi_iniziali_unita
  FOR INSERT WITH CHECK (user_owns_condominio(condominio_id));
CREATE POLICY "saldi own update" ON saldi_iniziali_unita
  FOR UPDATE USING (user_owns_condominio(condominio_id))
             WITH CHECK (user_owns_condominio(condominio_id));
CREATE POLICY "saldi own delete" ON saldi_iniziali_unita
  FOR DELETE USING (user_owns_condominio(condominio_id));

-- D2-ter (A) — branding studio su profiles (riusabile su tutti i documenti)
-- logo come data-URL base64: jsPDF.addImage lo consuma diretto, niente bucket/signed-url.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS studio_nome text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS studio_indirizzo text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS studio_contatti text;   -- blocco libero multilinea (tel/email/PEC/P.IVA)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_base64 text;       -- data:image/...;base64,....

NOTIFY pgrst, 'reload schema';
