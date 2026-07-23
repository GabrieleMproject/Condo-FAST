-- sql/s62_backoffice_v2.sql
-- Estensioni del database per il Backoffice SuperAdmin Fase 1 & Fase 2

-- 1. Aggiunta colonne per note amministrative, bonus AI e feature flags
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS note_admin TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_bonus_calls INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

-- 2. Aggiornamento funzione RPC get_utenti_statistiche
DROP FUNCTION IF EXISTS public.get_utenti_statistiche();

CREATE OR REPLACE FUNCTION public.get_utenti_statistiche()
RETURNS TABLE (
    id uuid,
    email text,
    nome text,
    cognome text,
    studio_nome text,
    ragione_sociale text,
    piano text,
    is_superadmin boolean,
    is_beta_tester boolean,
    created_at timestamptz,
    condomini_count bigint,
    ai_calls_count bigint,
    collaboratori_count bigint,
    note_admin text,
    ai_bonus_calls int,
    feature_flags jsonb
) AS $$
BEGIN
    -- Controllo di sicurezza: solo i SuperAdmin possono eseguire questa RPC
    IF NOT public.is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'Accesso negato. Solo i SuperAdmin possono accedere a questi dati.';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.nome,
        p.cognome,
        p.studio_nome,
        p.ragione_sociale,
        p.piano,
        p.is_superadmin,
        p.is_beta_tester,
        p.created_at,
        COALESCE(c.cnt, 0)::bigint AS condomini_count,
        COALESCE(ai.cnt, 0)::bigint AS ai_calls_count,
        COALESCE(col.cnt, 0)::bigint AS collaboratori_count,
        p.note_admin,
        COALESCE(p.ai_bonus_calls, 0)::int AS ai_bonus_calls,
        COALESCE(p.feature_flags, '{}'::jsonb) AS feature_flags
    FROM public.profiles p
    LEFT JOIN (
        SELECT cond.amministratore_id, COUNT(*) AS cnt 
        FROM public.condomini cond
        GROUP BY cond.amministratore_id
    ) c ON c.amministratore_id = p.id
    LEFT JOIN (
        SELECT acl.user_id, COUNT(*) AS cnt 
        FROM public.ai_call_log acl
        WHERE acl.timestamp >= date_trunc('month', now() AT TIME ZONE 'UTC')
        GROUP BY acl.user_id
    ) ai ON ai.user_id = p.id
    LEFT JOIN (
        SELECT colab.amministratore_id, COUNT(*) AS cnt 
        FROM public.collaboratori_studio colab
        WHERE colab.attivo = true
        GROUP BY colab.amministratore_id
    ) col ON col.amministratore_id = p.id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
