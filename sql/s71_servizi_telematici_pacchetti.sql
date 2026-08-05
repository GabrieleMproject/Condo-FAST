-- sql/s71_servizi_telematici_pacchetti.sql
-- Migrazione per la gestione dei pacchetti Telematici e Privacy

ALTER TABLE condominio_servizi_telematici
DROP COLUMN IF EXISTS prezzo_rivendita,
DROP COLUMN IF EXISTS platform_fee_percent,
ADD COLUMN IF NOT EXISTS pacchetto varchar(50) DEFAULT 'nessuno',
ADD COLUMN IF NOT EXISTS admin_disclaimer_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255);

-- Aggiorna eventuali record esistenti mappandoli al pacchetto base (se attivi)
UPDATE condominio_servizi_telematici
SET pacchetto = 'base_36'
WHERE attivo = true AND pacchetto = 'nessuno';

-- Commento esplicativo sulle opzioni previste per la colonna pacchetto:
-- 'nessuno': Nessun pacchetto attivo (Freemium Operativo / App Bloccata per Condòmini)
-- 'base_36': Conservazione Sostitutiva + Base. Costo 36€/anno. Sconto admin 12€/anno.
-- 'app_limitata_100': Portale Documenti Limitato. Costo 100€/anno. Sconto admin 30€/anno.
-- 'app_full_150': App Condòmini Completa. Costo 150€/anno. Sconto admin 50€/anno.
