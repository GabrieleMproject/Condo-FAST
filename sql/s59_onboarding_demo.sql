-- SQL Migration: Onboarding & Demo Condominium Support
-- Add is_demo to condomini and onboarding_state to profiles

ALTER TABLE public.condomini 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_state JSONB DEFAULT '{"completed_steps":[],"tour_seen":false}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.condomini.is_demo IS 'Flag per identificare i condomini demo di prova per utenti trial';
COMMENT ON COLUMN public.profiles.onboarding_state IS 'Stato di completamento dell''onboarding e del tour guidato per l''utente';
