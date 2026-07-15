-- =============================================================================
-- S46 — SEZIONE GESTIONE SINISTRI CONDOMINIALI
-- =============================================================================

-- 1. Creazione della tabella sinistri
CREATE TABLE IF NOT EXISTS public.sinistri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    titolo TEXT NOT NULL,
    codice_sinistro TEXT,
    data_evento DATE NOT NULL,
    data_denuncia DATE,
    descrizione TEXT,
    stato TEXT NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto', 'perizia', 'liquidato', 'respinto', 'chiuso')),
    importo_stimato NUMERIC(12, 2) DEFAULT 0.00,
    importo_liquidato NUMERIC(12, 2) DEFAULT 0.00,
    franchigia NUMERIC(12, 2) DEFAULT 0.00,
    unita_origine_id UUID REFERENCES public.unita(id) ON DELETE SET NULL,
    note_interne TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    amministratore_id UUID DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id)
);

-- 2. Aggiunta relazioni nelle tabelle esistenti
ALTER TABLE public.documenti_condominio 
ADD COLUMN IF NOT EXISTS sinistro_id UUID REFERENCES public.sinistri(id) ON DELETE SET NULL;

ALTER TABLE public.spese 
ADD COLUMN IF NOT EXISTS sinistro_id UUID REFERENCES public.sinistri(id) ON DELETE SET NULL;

-- 3. Abilitazione Row Level Security (RLS) su sinistri
ALTER TABLE public.sinistri ENABLE ROW LEVEL SECURITY;

-- 4. Creazione policy RLS per la tabella sinistri
CREATE POLICY "Gli amministratori possono gestire i sinistri del proprio condominio"
ON public.sinistri
FOR ALL
USING (
    public.user_owns_condominio(condominio_id)
)
WITH CHECK (
    public.user_owns_condominio(condominio_id)
);

-- 5. Aggiornamento funzione trigger dell'audit log per mappare la categoria 'sinistri'
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_condominio_id UUID;
  v_record_id UUID;
  v_dati_prima JSONB;
  v_dati_dopo JSONB;
  v_user_id UUID;
  v_categoria TEXT;
  v_table_name TEXT;
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
    WHEN 'unita'                THEN 'anagrafica'
    WHEN 'persone'              THEN 'anagrafica'
    WHEN 'occupanti_unita'      THEN 'anagrafica'
    WHEN 'spese'                THEN 'spese'
    WHEN 'ripartizioni'         THEN 'ripartizioni'
    WHEN 'documenti_condominio'  THEN 'documenti'
    WHEN 'esercizi'             THEN 'esercizi'
    WHEN 'tabelle_millesimali'  THEN 'millesimi'
    WHEN 'millesimi_unita'      THEN 'millesimi'
    WHEN 'sinistri'             THEN 'sinistri'
    ELSE 'altro'
  END;

  -- Se il condominio è in fase di cancellazione, l'audit_log non deve referenziare
  -- un condominio inesistente, altrimenti viola la FK (audit_log_condominio_id_fkey).
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

-- 6. Trigger di audit sulla tabella sinistri
CREATE TRIGGER audit_sinistri_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sinistri
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 7. Notifica ricaricamento dello schema per PostgREST
NOTIFY pgrst, 'reload schema';
