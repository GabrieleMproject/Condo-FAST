-- sql/s13_backoffice.sql

-- 1. Aggiungiamo is_superadmin ai profili
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- 2. Creiamo una function per bypassare RLS e controllare se l'utente è superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(check_user_id uuid)
RETURNS boolean AS $$
DECLARE
    is_admin boolean;
BEGIN
    SELECT is_superadmin INTO is_admin FROM public.profiles WHERE id = check_user_id;
    RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Policy su profiles per permettere ai superadmin di vedere tutto
CREATE POLICY superadmin_view_profiles ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_superadmin(auth.uid()));

-- 4. Creiamo la tabella tickets_assistenza
CREATE TABLE IF NOT EXISTS public.tickets_assistenza (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    titolo text NOT NULL,
    messaggio text NOT NULL,
    risposta_admin text,
    stato text NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto', 'chiuso')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tickets_assistenza ENABLE ROW LEVEL SECURITY;

-- 5. Policy tickets_assistenza
CREATE POLICY user_select_tickets ON public.tickets_assistenza
    FOR SELECT TO authenticated
    USING (utente_id = auth.uid() OR public.is_superadmin(auth.uid()));

CREATE POLICY user_insert_tickets ON public.tickets_assistenza
    FOR INSERT TO authenticated
    WITH CHECK (utente_id = auth.uid());

CREATE POLICY superadmin_update_tickets ON public.tickets_assistenza
    FOR UPDATE TO authenticated
    USING (public.is_superadmin(auth.uid()));

NOTIFY pgrst, 'reload schema';
