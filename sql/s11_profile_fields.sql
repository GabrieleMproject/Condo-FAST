-- sql/s11_profile_fields.sql
-- Aggiunta dei campi fiscali alla tabella profiles (Ragione Sociale, Partita IVA, Codice Fiscale)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ragione_sociale text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partita_iva text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS codice_fiscale text;

NOTIFY pgrst, 'reload schema';
