-- sql/s32_notification_settings.sql
-- Aggiunge la colonna notification_settings (JSONB) a profiles
-- per configurare i promemoria temporali dell'amministratore.
-- Sessione S32 — 10 Luglio 2026

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"f24_ritenute":{"enabled":true},"rate_scadute":{"enabled":true,"giorni_dopo_scadenza":10},"esercizio_in_scadenza":{"enabled":true,"giorni_prima":30},"movimenti_non_riconciliati":{"enabled":false,"giorni_tolleranza":15}}'::jsonb;

-- Aggiorna i record esistenti che hanno notification_settings NULL
UPDATE profiles
SET notification_settings = '{"f24_ritenute":{"enabled":true},"rate_scadute":{"enabled":true,"giorni_dopo_scadenza":10},"esercizio_in_scadenza":{"enabled":true,"giorni_prima":30},"movimenti_non_riconciliati":{"enabled":false,"giorni_tolleranza":15}}'::jsonb
WHERE notification_settings IS NULL;
