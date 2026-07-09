-- sql/s29_tranche2_setup.sql
-- =============================================================================
-- TRANCHE 2 SETUP: Mittente personalizzato in profiles + IBAN in condomini
-- =============================================================================

-- 1. Nuove colonne nella tabella profiles per la gestione email
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mail_invio_tipo text DEFAULT 'sistema' CHECK (mail_invio_tipo IN ('sistema', 'smtp', 'resend_custom'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mail_mittente_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mail_mittente_nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smtp_port integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smtp_user text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smtp_password text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resend_api_key text;

-- 2. Aggiunta colonna IBAN alla tabella condomini
ALTER TABLE public.condomini ADD COLUMN IF NOT EXISTS iban text;

-- Notifica ricaricamento schema PostgREST
NOTIFY pgrst, 'reload schema';
