-- sql/s66_revenue_share_markup.sql
-- Aggiunge campi per il calcolo del markup e della platform fee

ALTER TABLE condominio_servizi_telematici
ADD COLUMN IF NOT EXISTS prezzo_rivendita numeric(10,2) DEFAULT 36.00,
ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) DEFAULT 30.00;
