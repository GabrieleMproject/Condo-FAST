-- sql/s64_modulo_privacy_telematici.sql
-- Modulo Conservazione Fiscale, Privacy GDPR & Risparmio Studio

CREATE TABLE IF NOT EXISTS condominio_servizi_telematici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condomini(id) ON DELETE CASCADE,
  attivo boolean DEFAULT false,
  data_attivazione timestamp with time zone,
  costo_annuale numeric(10,2) DEFAULT 36.00,
  sconto_mensile_admin numeric(10,2) DEFAULT 1.00,
  prezzo_rivendita numeric(10,2) DEFAULT 36.00,
  platform_fee_percent numeric(5,2) DEFAULT 30.00,
  verbale_approvazione_id uuid REFERENCES documenti_condominio(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(condominio_id)
);

-- RLS
ALTER TABLE condominio_servizi_telematici ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori e SuperAdmin possono gestire i servizi telematici"
ON condominio_servizi_telematici
FOR ALL
TO authenticated
USING (
  user_owns_condominio(condominio_id) OR is_superadmin(auth.uid())
)
WITH CHECK (
  user_owns_condominio(condominio_id) OR is_superadmin(auth.uid())
);

-- Trigger for updated_at (Assuming trigger function update_modified_column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_modified_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_condominio_servizi_telematici_modtime') THEN
      CREATE TRIGGER update_condominio_servizi_telematici_modtime
      BEFORE UPDATE ON condominio_servizi_telematici
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_column();
    END IF;
  END IF;
END
$$;
