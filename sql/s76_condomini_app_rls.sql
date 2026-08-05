-- sql/s76_condomini_app_rls.sql
-- Row Level Security per gli utenti App Condòmini (Condòmini)
-- Il condomino è registrato su auth.users e il suo user_id combacia con public.persone.user_id

-- Helper function: Verifica se l'utente loggato è il proprietario di quel record persona
CREATE OR REPLACE FUNCTION public.condomino_owns_persona(p_persona_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.persone
        WHERE id = p_persona_id AND user_id = auth.uid()
    );
$$;

-- Helper function: Ritorna gli ID dei condomini in cui la persona ha almeno un'unità
CREATE OR REPLACE FUNCTION public.get_my_condomini_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER AS $$
    SELECT DISTINCT u.condominio_id 
    FROM public.occupanti_unita ou
    JOIN public.unita u ON ou.unita_id = u.id
    JOIN public.persone p ON ou.persona_id = p.id
    WHERE p.user_id = auth.uid();
$$;

-- Helper function: Ritorna gli ID delle unità occupate dall'utente loggato
CREATE OR REPLACE FUNCTION public.get_my_unita_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER AS $$
    SELECT ou.unita_id 
    FROM public.occupanti_unita ou
    JOIN public.persone p ON ou.persona_id = p.id
    WHERE p.user_id = auth.uid();
$$;


-- ==========================================
-- ABILITAZIONE RLS PER CONDÒMINI (SELECT ONLY)
-- ==========================================

-- 1. PERSONE (può leggere il proprio record)
CREATE POLICY "condomino_read_own_persona" 
ON public.persone FOR SELECT 
USING (user_id = auth.uid());

-- 2. CONDOMINI (può leggere il condominio in cui abita)
CREATE POLICY "condomino_read_own_condominio" 
ON public.condomini FOR SELECT 
USING (id IN (SELECT public.get_my_condomini_ids()));

-- 3. UNITA (può leggere le proprie unità)
CREATE POLICY "condomino_read_own_unita" 
ON public.unita FOR SELECT 
USING (id IN (SELECT public.get_my_unita_ids()));

-- 4. OCCUPANTI_UNITA (può leggere se stesso e gli altri occupanti della sua stessa unità, utile per le comproprietà)
CREATE POLICY "condomino_read_own_occupazioni" 
ON public.occupanti_unita FOR SELECT 
USING (unita_id IN (SELECT public.get_my_unita_ids()));

-- 5. RATE_UNITA (può leggere le proprie rate)
CREATE POLICY "condomino_read_own_rate_unita" 
ON public.rate_unita FOR SELECT 
USING (unita_id IN (SELECT public.get_my_unita_ids()));

-- 6. RATE (può leggere le rate globali collegate alle sue rate_unita)
CREATE POLICY "condomino_read_own_rate" 
ON public.rate FOR SELECT 
USING (condominio_id IN (SELECT public.get_my_condomini_ids()));

-- 7. ASSEMBLEE (può leggere le assemblee del suo condominio)
CREATE POLICY "condomino_read_own_assemblee" 
ON public.assemblee FOR SELECT 
USING (condominio_id IN (SELECT public.get_my_condomini_ids()));

-- 8. ASSEMBLEE ODG (può leggere l'ordine del giorno delle sue assemblee)
CREATE POLICY "condomino_read_own_assemblee_odg" 
ON public.assemblee_odg FOR SELECT 
USING (assemblea_id IN (
    SELECT id FROM public.assemblee WHERE condominio_id IN (SELECT public.get_my_condomini_ids())
));

-- 9. ASSEMBLEE PRESENZE E VOTI
CREATE POLICY "condomino_read_own_presenze" 
ON public.assemblee_presenze FOR SELECT 
USING (persona_id IN (
    SELECT id FROM public.persone WHERE user_id = auth.uid()
));

CREATE POLICY "condomino_read_own_voti" 
ON public.assemblee_voti FOR SELECT 
USING (persona_id IN (
    SELECT id FROM public.persone WHERE user_id = auth.uid()
));
