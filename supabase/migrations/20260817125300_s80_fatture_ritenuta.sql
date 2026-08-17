-- supabase/migrations/20260817125300_s80_fatture_ritenuta.sql

-- Aggiunta campi mancanti alla tabella fatture_fornitori che causavano errori 400 Bad Request
ALTER TABLE public.fatture_fornitori ADD COLUMN IF NOT EXISTS ritenuta_pagata boolean DEFAULT false;
ALTER TABLE public.fatture_fornitori ADD COLUMN IF NOT EXISTS fornitore text;
