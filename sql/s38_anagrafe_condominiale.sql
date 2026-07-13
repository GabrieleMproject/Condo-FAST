-- =============================================================================
-- S38 — ESTENSIONI SCHEMA PER REGISTRO ANAGRAFE CONDOMINIALE
-- =============================================================================

-- 1. Aggiunta campi catastali alla tabella unita
ALTER TABLE public.unita ADD COLUMN IF NOT EXISTS catasto_foglio text;
ALTER TABLE public.unita ADD COLUMN IF NOT EXISTS catasto_particella text;
ALTER TABLE public.unita ADD COLUMN IF NOT EXISTS catasto_subalterno text;
ALTER TABLE public.unita ADD COLUMN IF NOT EXISTS catasto_categoria text;
ALTER TABLE public.unita ADD COLUMN IF NOT EXISTS catasto_rendita numeric;

-- 2. Aggiunta campi residenza alla tabella persone
ALTER TABLE public.persone ADD COLUMN IF NOT EXISTS residenza_indirizzo text;
ALTER TABLE public.persone ADD COLUMN IF NOT EXISTS residenza_comune text;
ALTER TABLE public.persone ADD COLUMN IF NOT EXISTS residenza_cap text;
ALTER TABLE public.persone ADD COLUMN IF NOT EXISTS residenza_provincia text;

-- Notifica ricaricamento dello schema per PostgREST
NOTIFY pgrst, 'reload schema';
