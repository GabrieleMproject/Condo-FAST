-- sql/s33_referral_program.sql

-- 1. Funzione per generare codici referral univoci
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text AS $$
DECLARE
    new_code text;
    exists_code boolean;
BEGIN
    LOOP
        -- Genera un codice casuale alfanumerico di 8 caratteri
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO exists_code;
        IF NOT exists_code THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Aggiunta colonna referral_code a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 3. Imposta default per le future registrazioni
ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT public.generate_referral_code();

-- 4. Genera codici per i profili esistenti che non lo hanno
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- 5. Rendi referral_code NOT NULL
ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

-- 6. Tabella Campagne Marketing Referral
CREATE TABLE IF NOT EXISTS public.referral_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    codice_campagna text UNIQUE NOT NULL,
    sconto_importo numeric(10,2) NOT NULL DEFAULT 10.00,
    attiva boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Abilita RLS su referral_campaigns
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy per referral_campaigns
DROP POLICY IF EXISTS select_campaigns ON public.referral_campaigns;
CREATE POLICY select_campaigns ON public.referral_campaigns
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS superadmin_manage_campaigns ON public.referral_campaigns;
CREATE POLICY superadmin_manage_campaigns ON public.referral_campaigns
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- Inserisci una campagna di default se non esiste
INSERT INTO public.referral_campaigns (nome, codice_campagna, sconto_importo, attiva)
VALUES ('Campagna di Lancio', 'LANCIO2026', 15.00, true)
ON CONFLICT (codice_campagna) DO NOTHING;

-- 7. Tabella di tracciamento Referral
CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    campaign_id uuid REFERENCES public.referral_campaigns(id) ON DELETE SET NULL,
    referred_email text NOT NULL,
    sconto_valore numeric(10,2) NOT NULL,
    stato text NOT NULL DEFAULT 'registrato' CHECK (stato IN ('registrato', 'convalidato', 'applicato')),
    created_at timestamptz DEFAULT now(),
    validated_at timestamptz,
    applied_at timestamptz
);

-- Abilita RLS su referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy per referrals
DROP POLICY IF EXISTS select_my_referrals ON public.referrals;
CREATE POLICY select_my_referrals ON public.referrals
    FOR SELECT TO authenticated
    USING (referrer_id = auth.uid() OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS insert_referral_client ON public.referrals;
CREATE POLICY insert_referral_client ON public.referrals
    FOR INSERT TO authenticated
    WITH CHECK (referred_id = auth.uid());

DROP POLICY IF EXISTS superadmin_manage_referrals ON public.referrals;
CREATE POLICY superadmin_manage_referrals ON public.referrals
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- 8. Aggiorna il trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    referrer_profile_id uuid;
    active_campaign_id uuid;
    active_campaign_sconto numeric;
    new_referral_code text;
    exists_code boolean;
BEGIN
    -- Genera codice referral univoco per il nuovo profilo
    LOOP
        new_referral_code := upper(substring(md5(random()::text) from 1 for 8));
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_referral_code) INTO exists_code;
        IF NOT exists_code THEN
            EXIT;
        END IF;
    END LOOP;

    -- Inserisci il profilo
    INSERT INTO public.profiles (id, email, nome, cognome, referral_code)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'nome',
        new.raw_user_meta_data->>'cognome',
        new_referral_code
    );

    -- Se c'è un codice di invito 'ref' nei metadati
    IF new.raw_user_meta_data->>'ref' IS NOT NULL AND new.raw_user_meta_data->>'ref' <> '' THEN
        -- Trova il referrer dal codice referral
        SELECT id INTO referrer_profile_id 
        FROM public.profiles 
        WHERE referral_code = upper(trim(new.raw_user_meta_data->>'ref'));

        IF referrer_profile_id IS NOT NULL THEN
            -- Trova la campagna marketing attiva
            SELECT id, sconto_importo INTO active_campaign_id, active_campaign_sconto
            FROM public.referral_campaigns
            WHERE attiva = true
            LIMIT 1;

            -- Inserisci il referral se c'è una campagna attiva
            IF active_campaign_id IS NOT NULL THEN
                INSERT INTO public.referrals (referrer_id, referred_id, campaign_id, referred_email, sconto_valore, stato)
                VALUES (referrer_profile_id, new.id, active_campaign_id, new.email, active_campaign_sconto, 'registrato');
            END IF;
        END IF;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ricrea il trigger (facoltativo ma garantisce consistenza)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Notifica pgrst per ricaricare lo schema
NOTIFY pgrst, 'reload schema';
