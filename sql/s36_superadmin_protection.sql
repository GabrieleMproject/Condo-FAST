-- sql/s36_superadmin_protection.sql
-- Protegge la colonna is_superadmin da modifiche non autorizzate (privilege escalation)

-- 1. Trigger che blocca la modifica di is_superadmin a utenti non-superadmin
CREATE OR REPLACE FUNCTION public.check_is_superadmin_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin THEN
    IF NOT public.is_superadmin(auth.uid()) THEN
      RAISE EXCEPTION 'Solo i SuperAdmin possono modificare i permessi di superadmin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_check_superadmin_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_is_superadmin_update();

-- 2. Aggiorna la policy di UPDATE su profiles per consentire ai SuperAdmin
--    di modificare anche i profili altrui (necessario per handlePromuovi in BackofficePage)
DROP POLICY IF EXISTS "Utente aggiorna solo il proprio profilo" ON public.profiles;
CREATE POLICY "Utenti e SuperAdmin aggiornano i profili" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_superadmin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_superadmin(auth.uid()));

NOTIFY pgrst, 'reload schema';
