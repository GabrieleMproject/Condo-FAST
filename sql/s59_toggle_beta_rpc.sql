-- sql/s59_toggle_beta_rpc.sql
-- RPC sicura per permettere al SuperAdmin di togglare lo stato beta tester bypassando RLS

DROP FUNCTION IF EXISTS public.toggle_beta_tester(uuid, boolean);

CREATE OR REPLACE FUNCTION public.toggle_beta_tester(target_user_id uuid, target_status boolean)
RETURNS void AS $$
BEGIN
    -- 1. Verifica che chi chiama sia SuperAdmin
    IF NOT public.is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'Accesso negato. Solo i SuperAdmin possono modificare lo stato Beta Tester.';
    END IF;

    -- 2. Esegue l'update bypassando RLS (poiché la funzione è SECURITY DEFINER)
    UPDATE public.profiles
    SET is_beta_tester = target_status,
        updated_at = now()
    WHERE id = target_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
