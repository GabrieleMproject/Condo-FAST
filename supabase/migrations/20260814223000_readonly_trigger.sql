-- =================================================================================
-- Funzione e Trigger per bloccare modifiche in modalità "Sola Lettura"
-- L'account diventa di sola lettura se il periodo di trial è scaduto
-- e non c'è un abbonamento Stripe attivo ('active' o 'trialing').
-- =================================================================================

CREATE OR REPLACE FUNCTION public.check_readonly_status()
RETURNS TRIGGER AS $$
DECLARE
  v_piano text;
  v_stripe_status text;
  v_trial_ends_at timestamptz;
  v_is_readonly boolean := false;
BEGIN
  -- Se l'operazione non proviene da un utente web autenticato, permetti l'operazione.
  -- Questo permette alle Edge Functions o agli amministratori (Service Role) di operare normalmente.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Recupera il profilo dell'utente corrente
  SELECT piano, stripe_status, trial_ends_at
  INTO v_piano, v_stripe_status, v_trial_ends_at
  FROM public.profiles
  WHERE id = auth.uid();

  -- Se il profilo non viene trovato (es. durante la registrazione), permetti
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determina se l'account è in read-only
  IF v_piano = 'trial' AND v_trial_ends_at < now() THEN
    v_is_readonly := true;
  ELSIF v_piano != 'trial' AND (v_stripe_status IS NULL OR v_stripe_status NOT IN ('active', 'trialing')) THEN
    v_is_readonly := true;
  END IF;

  IF v_is_readonly THEN
    RAISE EXCEPTION 'Account in sola lettura. Impossibile modificare i dati. Rinnova il tuo abbonamento.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================================
-- Applica il trigger a tutte le tabelle pubbliche
-- =================================================================================

DO $$
DECLARE
  t text;
BEGIN
  -- Applica a tutte le tabelle BASE nel public schema, escludendo alcune di sistema o logs
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('ai_call_log', 'profiles') -- Evita di bloccare i log delle chiamate AI e le tabelle di sistema se necessario
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_check_readonly ON public.%I;
      CREATE TRIGGER trg_check_readonly
      BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.check_readonly_status();
    ', t, t);
  END LOOP;
END;
$$;
