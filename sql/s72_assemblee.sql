-- sql/s72_assemblee.sql
-- Modulo Assemblee e Votazioni in Real-Time

-- 1. Tabelle
CREATE TABLE public.assemblee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID NOT NULL REFERENCES public.condomini(id) ON DELETE CASCADE,
    titolo TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('ordinaria', 'straordinaria')),
    stato TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'convocata', 'in_corso', 'conclusa')),
    data_inizio TIMESTAMPTZ,
    luogo TEXT,
    link_video TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.assemblee_odg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assemblea_id UUID NOT NULL REFERENCES public.assemblee(id) ON DELETE CASCADE,
    numero_ordine INTEGER NOT NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    tabella_millesimale_id UUID REFERENCES public.tabelle_millesimali(id) ON DELETE SET NULL,
    stato_votazione TEXT NOT NULL DEFAULT 'chiusa' CHECK (stato_votazione IN ('chiusa', 'in_corso')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.assemblee_presenze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assemblea_id UUID NOT NULL REFERENCES public.assemblee(id) ON DELETE CASCADE,
    unita_id UUID NOT NULL REFERENCES public.unita(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    delegato_a_persona_id UUID REFERENCES public.persone(id) ON DELETE SET NULL,
    presente BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assemblea_id, unita_id, persona_id)
);

CREATE TABLE public.assemblee_voti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odg_id UUID NOT NULL REFERENCES public.assemblee_odg(id) ON DELETE CASCADE,
    unita_id UUID NOT NULL REFERENCES public.unita(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES public.persone(id) ON DELETE CASCADE,
    voto TEXT NOT NULL CHECK (voto IN ('favorevole', 'contrario', 'astenuto')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(odg_id, unita_id, persona_id)
);

-- 2. Enable RLS
ALTER TABLE public.assemblee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assemblee_odg ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assemblee_presenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assemblee_voti ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- assemblee
CREATE POLICY "Utente può vedere assemblee dei propri condomini"
    ON public.assemblee FOR SELECT
    USING (public.user_owns_condominio(condominio_id));

CREATE POLICY "Utente può gestire assemblee dei propri condomini"
    ON public.assemblee FOR ALL
    USING (public.user_owns_condominio(condominio_id));

-- assemblee_odg
CREATE POLICY "Utente può vedere odg delle proprie assemblee"
    ON public.assemblee_odg FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee a
            WHERE a.id = assemblee_odg.assemblea_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

CREATE POLICY "Utente può gestire odg delle proprie assemblee"
    ON public.assemblee_odg FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee a
            WHERE a.id = assemblee_odg.assemblea_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

-- assemblee_presenze
CREATE POLICY "Utente può vedere presenze delle proprie assemblee"
    ON public.assemblee_presenze FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee a
            WHERE a.id = assemblee_presenze.assemblea_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

CREATE POLICY "Utente può gestire presenze delle proprie assemblee"
    ON public.assemblee_presenze FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee a
            WHERE a.id = assemblee_presenze.assemblea_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

-- assemblee_voti
CREATE POLICY "Utente può vedere voti delle proprie assemblee"
    ON public.assemblee_voti FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee_odg odg
            JOIN public.assemblee a ON odg.assemblea_id = a.id
            WHERE odg.id = assemblee_voti.odg_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

CREATE POLICY "Utente può gestire voti delle proprie assemblee"
    ON public.assemblee_voti FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assemblee_odg odg
            JOIN public.assemblee a ON odg.assemblea_id = a.id
            WHERE odg.id = assemblee_voti.odg_id
            AND public.user_owns_condominio(a.condominio_id)
        )
    );

-- 4. Enable Realtime per le tabelle (se la publication esiste)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_odg;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_presenze;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assemblee_voti;
    END IF;
END $$;
