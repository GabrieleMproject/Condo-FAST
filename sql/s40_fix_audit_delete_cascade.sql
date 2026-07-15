-- sql/s40_fix_audit_delete_cascade.sql
-- Fix per errore di foreign key su audit_log durante la cancellazione a cascata (DELETE CASCADE) del condominio.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_condominio_id UUID;
  v_record_id UUID;
  v_dati_prima JSONB;
  v_dati_dopo JSONB;
  v_user_id UUID;
  v_categoria TEXT;
BEGIN
  BEGIN
    v_user_id := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_dati_prima := to_jsonb(OLD);
    v_dati_dopo := NULL;
    BEGIN v_condominio_id := (to_jsonb(OLD)->>'condominio_id')::UUID; EXCEPTION WHEN OTHERS THEN v_condominio_id := NULL; END;
  ELSE
    v_record_id := NEW.id;
    v_dati_dopo := to_jsonb(NEW);
    v_dati_prima := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    BEGIN v_condominio_id := (to_jsonb(NEW)->>'condominio_id')::UUID; EXCEPTION WHEN OTHERS THEN v_condominio_id := NULL; END;
  END IF;

  v_categoria := CASE TG_TABLE_NAME
    WHEN 'unita'               THEN 'anagrafica'
    WHEN 'persone'             THEN 'anagrafica'
    WHEN 'occupanti_unita'     THEN 'anagrafica'
    WHEN 'spese'               THEN 'spese'
    WHEN 'ripartizioni'        THEN 'ripartizioni'
    WHEN 'documenti_condominio' THEN 'documenti'
    WHEN 'esercizi'            THEN 'esercizi'
    WHEN 'tabelle_millesimali' THEN 'millesimi'
    WHEN 'millesimi_unita'     THEN 'millesimi'
    ELSE 'altro'
  END;

  -- ✅ Fix: Se il condominio è in fase di cancellazione, l'audit_log non deve referenziare
  -- un condominio inesistente, altrimenti viola la FK (audit_log_condominio_id_fkey).
  -- Impostiamo condominio_id a NULL se il record non è più presente in public.condomini.
  IF v_condominio_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.condomini WHERE id = v_condominio_id) THEN
      v_condominio_id := NULL;
    END IF;
  END IF;

  INSERT INTO audit_log (
    condominio_id, tabella_modificata, record_id,
    azione, categoria, dati_prima, dati_dopo, user_id
  ) VALUES (
    v_condominio_id, TG_TABLE_NAME, v_record_id,
    TG_OP, v_categoria, v_dati_prima, v_dati_dopo, v_user_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
