-- sql/s57_stripe_fields_protection.sql
-- FIX C3: Protegge le colonne Stripe sensibili da modifiche non autorizzate (privilege escalation)
-- Solo service_role (webhook Stripe) o SuperAdmin possono modificare questi campi.

-- 1. Trigger che blocca la modifica di stripe_status, stripe_customer_id, stripe_subscription_id, stripe_condomini_item_id
CREATE OR REPLACE FUNCTION public.check_stripe_fields_update()
RETURNS trigger AS $$
BEGIN
  -- Verifica se uno dei campi Stripe sensibili è stato modificato
  IF (NEW.stripe_status IS DISTINCT FROM OLD.stripe_status)
     OR (NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id)
     OR (NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id)
     OR (NEW.stripe_condomini_item_id IS DISTINCT FROM OLD.stripe_condomini_item_id) THEN

    -- Consente le modifiche solo se effettuate da service_role o da un SuperAdmin.
    -- Se auth.role() è nullo (es. migrazioni locali o CLI dirette), non blocca.
    IF auth.role() IS NOT NULL AND auth.role() != 'service_role' AND NOT public.is_superadmin(auth.uid()) THEN
      RAISE EXCEPTION 'Non hai i permessi per modificare direttamente i campi Stripe del profilo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crea il trigger (drop se già esiste per idempotenza)
DROP TRIGGER IF EXISTS trg_check_stripe_fields_update ON public.profiles;
CREATE TRIGGER trg_check_stripe_fields_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_stripe_fields_update();

NOTIFY pgrst, 'reload schema';
