-- sql/s39_backoffice_marketing.sql
-- Estensioni per le funzionalità di marketing del backoffice superadmin

-- 1. Funzione per aggregare le statistiche di utilizzo per ciascun utente
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
    created_at timestamptz,
    condomini_count bigint,
    ai_calls_count bigint,
    collaboratori_count bigint
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
        p.created_at,
        COALESCE(c.cnt, 0)::bigint AS condomini_count,
        COALESCE(ai.cnt, 0)::bigint AS ai_calls_count,
        COALESCE(col.cnt, 0)::bigint AS collaboratori_count
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

-- 2. Impedisce a utenti non-superadmin (e non service_role) di modificare autonomamente la colonna "piano"
CREATE OR REPLACE FUNCTION public.check_piano_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.piano IS DISTINCT FROM OLD.piano THEN
    -- Consente le modifiche solo se effettuate da service_role o se l'utente è un SuperAdmin.
    -- Se auth.role() è nullo (es. migrazioni locali o CLI dirette), non blocca.
    IF auth.role() IS NOT NULL AND auth.role() != 'service_role' AND NOT public.is_superadmin(auth.uid()) THEN
      RAISE EXCEPTION 'Non hai i permessi per modificare direttamente la colonna piano.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_piano_update ON public.profiles;
CREATE TRIGGER trg_check_piano_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_piano_update();

NOTIFY pgrst, 'reload schema';

