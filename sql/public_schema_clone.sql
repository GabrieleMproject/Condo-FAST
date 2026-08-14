--
-- PostgreSQL database dump
--

\restrict 9hAs6IqZpFSfNpY6MMljkk8QM2TqAOXdKjWYKJZdtnNkaJzzc1Jren4cIBukymq

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: audit_trigger_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_trigger_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: check_piano_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_piano_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.piano IS DISTINCT FROM OLD.piano THEN
    -- Consente le modifiche solo se effettuate da service_role o se l'utente è un SuperAdmin.
    -- Se auth.role() è nullo (es. migrazioni locali o CLI dirette), non blocca.
    IF auth.role() IS NOT NULL AND auth.role() != 'service_role' AND NOT public.is_superadmin(auth.uid()) THEN
      RAISE EXCEPTION 'Non hai i permessi per modificare direttamente la colonna piano.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_stripe_fields_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stripe_fields_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: genera_rate_esercizio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.genera_rate_esercizio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  inizio DATE := NEW.data_inizio;
BEGIN
  INSERT INTO rate (esercizio_id, condominio_id, numero_rata, data_scadenza, percentuale)
  VALUES
    (NEW.id, NEW.condominio_id, 1, inizio + INTERVAL '3 months',  25),
    (NEW.id, NEW.condominio_id, 2, inizio + INTERVAL '6 months',  25),
    (NEW.id, NEW.condominio_id, 3, inizio + INTERVAL '9 months',  25),
    (NEW.id, NEW.condominio_id, 4, inizio + INTERVAL '12 months', 25);
  RETURN NEW;
END;
$$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_utenti_statistiche(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_utenti_statistiche() RETURNS TABLE(id uuid, email text, nome text, cognome text, studio_nome text, ragione_sociale text, piano text, is_superadmin boolean, is_beta_tester boolean, created_at timestamp with time zone, condomini_count bigint, ai_calls_count bigint, collaboratori_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Controllo di sicurezza: solo i SuperAdmin possono eseguire questa RPC
    IF NOT public.is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'Accesso negato. Solo i SuperAdmin possono accedere a questi dati.';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.nome,
        p.cognome,
        p.studio_nome,
        p.ragione_sociale,
        p.piano,
        p.is_superadmin,
        p.is_beta_tester,
        p.created_at,
        COALESCE(c.cnt, 0)::bigint AS condomini_count,
        COALESCE(ai.cnt, 0)::bigint AS ai_calls_count,
        COALESCE(col.cnt, 0)::bigint AS collaboratori_count
    FROM public.profiles p
    LEFT JOIN (
        SELECT cond.amministratore_id, COUNT(*) AS cnt 
        FROM public.condomini cond
        GROUP BY cond.amministratore_id
    ) c ON c.amministratore_id = p.id
    LEFT JOIN (
        SELECT acl.user_id, COUNT(*) AS cnt 
        FROM public.ai_call_log acl
        WHERE acl.timestamp >= date_trunc('month', now() AT TIME ZONE 'UTC')
        GROUP BY acl.user_id
    ) ai ON ai.user_id = p.id
    LEFT JOIN (
        SELECT colab.amministratore_id, COUNT(*) AS cnt 
        FROM public.collaboratori_studio colab
        WHERE colab.attivo = true
        GROUP BY colab.amministratore_id
    ) col ON col.amministratore_id = p.id
    ORDER BY p.created_at DESC;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    INSERT INTO public.profiles (id, email, nome, cognome, referral_code, dpa_accepted_at, dpa_ip)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'nome',
        new.raw_user_meta_data->>'cognome',
        new_referral_code,
        (new.raw_user_meta_data->>'dpa_accepted_at')::timestamptz,
        new.raw_user_meta_data->>'dpa_ip'
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
$$;


--
-- Name: is_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin(check_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    is_admin boolean;
BEGIN
    SELECT is_superadmin INTO is_admin FROM public.profiles WHERE id = check_user_id;
    RETURN COALESCE(is_admin, false);
END;
$$;


--
-- Name: match_condomino_cf(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_condomino_cf(p_codice_fiscale text, p_codice_app text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_condominio_id uuid;
    v_persone_aggiornate int := 0;
BEGIN
    -- Controlliamo se il codice_app esiste
    SELECT id INTO v_condominio_id 
    FROM condomini 
    WHERE UPPER(codice_app) = UPPER(p_codice_app) 
    LIMIT 1;
    
    IF v_condominio_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Troviamo tutte le persone in QUEL condominio che hanno il codice fiscale indicato
    -- e aggiorniamo il loro user_id con l'UID dell'utente attualmente loggato.
    -- (Una persona potrebbe avere più unità, quindi aggiorniamo tutti i record 'persone' 
    --  collegati al condominio con quel CF).
    
    UPDATE persone p
    SET user_id = auth.uid()
    FROM occupanti_unita ou, unita u
    WHERE p.id = ou.persona_id
      AND ou.unita_id = u.id
      AND u.condominio_id = v_condominio_id
      AND UPPER(p.codice_fiscale) = UPPER(p_codice_fiscale)
      AND p.user_id IS NULL; -- Se è già linkato a un utente, non sovrascrivere per sicurezza

    GET DIAGNOSTICS v_persone_aggiornate = ROW_COUNT;

    IF v_persone_aggiornate > 0 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;


--
-- Name: toggle_beta_tester(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_beta_tester(target_user_id uuid, target_status boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT public.is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'Accesso negato.';
    END IF;

    UPDATE public.profiles
    SET is_beta_tester = target_status,
        updated_at = now()
    WHERE id = target_user_id;

END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: user_owns_condominio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_condominio(condo_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.condomini c
    WHERE c.id = condo_id
    AND (
      c.amministratore_id = auth.uid()
      OR public.is_superadmin(auth.uid())
      -- Se l'utente è un collaboratore, ha accesso solo se c'è un'associazione esplicita in collaboratori_condomini
      OR c.amministratore_id IN (
         SELECT cs.amministratore_id 
         FROM public.collaboratori_studio cs
         JOIN public.collaboratori_condomini cc ON cc.collaboratore_id = cs.id
         WHERE (cs.utente_id = auth.uid() OR cs.email_collaboratore = auth.email())
           AND cs.attivo = true
           AND cc.condominio_id = condo_id
      )
    )
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_call_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_call_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    condominio_id uuid,
    funzione text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    token_input integer,
    token_output integer
);


--
-- Name: assemblee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assemblee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    titolo text NOT NULL,
    tipo text NOT NULL,
    stato text DEFAULT 'bozza'::text NOT NULL,
    data_inizio timestamp with time zone,
    luogo text,
    link_video text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT assemblee_stato_check CHECK ((stato = ANY (ARRAY['bozza'::text, 'convocata'::text, 'in_corso'::text, 'conclusa'::text]))),
    CONSTRAINT assemblee_tipo_check CHECK ((tipo = ANY (ARRAY['ordinaria'::text, 'straordinaria'::text])))
);


--
-- Name: assemblee_odg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assemblee_odg (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assemblea_id uuid NOT NULL,
    numero_ordine integer NOT NULL,
    titolo text NOT NULL,
    descrizione text,
    tabella_millesimale_id uuid,
    stato_votazione text DEFAULT 'chiusa'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT assemblee_odg_stato_votazione_check CHECK ((stato_votazione = ANY (ARRAY['chiusa'::text, 'in_corso'::text])))
);


--
-- Name: assemblee_presenze; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assemblee_presenze (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assemblea_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    delegato_a_persona_id uuid,
    presente boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: assemblee_voti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assemblee_voti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    odg_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    voto text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT assemblee_voti_voto_check CHECK ((voto = ANY (ARRAY['favorevole'::text, 'contrario'::text, 'astenuto'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid,
    tabella_modificata text NOT NULL,
    record_id uuid,
    azione text NOT NULL,
    categoria text NOT NULL,
    dati_prima jsonb,
    dati_dopo jsonb,
    user_id uuid,
    ip_address text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_azione_check CHECK ((azione = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
    CONSTRAINT audit_log_categoria_check CHECK ((categoria = ANY (ARRAY['anagrafica'::text, 'spese'::text, 'ripartizioni'::text, 'documenti'::text, 'esercizi'::text, 'millesimi'::text, 'altro'::text])))
);


--
-- Name: chat_assistenza_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_assistenza_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    trascrizione text NOT NULL,
    risolto_con_ticket boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: gemini_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gemini_rate_limit (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claude_rate_limit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gemini_rate_limit ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.claude_rate_limit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: collaboratori_condomini; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboratori_condomini (
    collaboratore_id uuid NOT NULL,
    condominio_id uuid NOT NULL
);


--
-- Name: collaboratori_studio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboratori_studio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amministratore_id uuid NOT NULL,
    email_collaboratore text NOT NULL,
    utente_id uuid,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comunicazioni; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comunicazioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid,
    amministratore_id uuid DEFAULT auth.uid() NOT NULL,
    destinatario_email text NOT NULL,
    destinatario_nome text,
    oggetto text NOT NULL,
    messaggio text NOT NULL,
    tipo text NOT NULL,
    stato text DEFAULT 'inviata'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_comunicazioni_tipo CHECK ((tipo = ANY (ARRAY['avviso'::text, 'sollecito'::text, 'generale'::text, 'sollecito_cartaceo'::text]))),
    CONSTRAINT comunicazioni_stato_check CHECK ((stato = ANY (ARRAY['inviata'::text, 'consegnata'::text, 'fallita'::text]))),
    CONSTRAINT comunicazioni_tipo_check CHECK ((tipo = ANY (ARRAY['avviso'::text, 'sollecito'::text, 'generale'::text])))
);


--
-- Name: COLUMN comunicazioni.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comunicazioni.tipo IS 'Tipo di comunicazione (avviso, sollecito, generale, sollecito_cartaceo)';


--
-- Name: condomini; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.condomini (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nome text NOT NULL,
    codice_fiscale text,
    indirizzo text NOT NULL,
    civico text,
    cap text,
    citta text NOT NULL,
    provincia text,
    anno_costruzione integer,
    num_unita integer DEFAULT 0,
    num_scale integer DEFAULT 1,
    num_piani integer,
    presenza_ascensore boolean DEFAULT false,
    presenza_giardino boolean DEFAULT false,
    presenza_parcheggio boolean DEFAULT false,
    presenza_portiere boolean DEFAULT false,
    data_inizio_amministrazione date,
    data_fine_amministrazione date,
    stato text DEFAULT 'attivo'::text NOT NULL,
    fondo_cassa numeric(12,2) DEFAULT 0,
    quote_annuali numeric(12,2) DEFAULT 0,
    note text,
    amministratore_id uuid NOT NULL,
    user_id uuid,
    iban text,
    codice_app character varying(6),
    CONSTRAINT condomini_stato_check CHECK ((stato = ANY (ARRAY['attivo'::text, 'archiviato'::text, 'sospeso'::text])))
);


--
-- Name: condominio_servizi_telematici; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.condominio_servizi_telematici (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    attivo boolean DEFAULT false,
    data_attivazione timestamp with time zone,
    costo_annuale numeric(10,2) DEFAULT 36.00,
    sconto_mensile_admin numeric(10,2) DEFAULT 1.00,
    prezzo_rivendita numeric(10,2) DEFAULT 36.00,
    platform_fee_percent numeric(5,2) DEFAULT 30.00,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    verbale_approvazione_id uuid,
    pacchetto text DEFAULT 'nessuno'::text NOT NULL,
    admin_disclaimer_accepted boolean DEFAULT false NOT NULL,
    stripe_subscription_id text,
    CONSTRAINT condominio_servizi_telematici_pacchetto_check CHECK ((pacchetto = ANY (ARRAY['nessuno'::text, 'base_36'::text, 'app_limitata_100'::text, 'app_full_150'::text])))
);


--
-- Name: config_pagante_unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_pagante_unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unita_id uuid NOT NULL,
    esercizio_id uuid NOT NULL,
    pagante text DEFAULT 'proprietario'::text NOT NULL,
    CONSTRAINT config_pagante_unita_pagante_check CHECK ((pagante = ANY (ARRAY['proprietario'::text, 'inquilino'::text])))
);


--
-- Name: consuntivo_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consuntivo_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amministratore_id uuid NOT NULL,
    nome text DEFAULT 'Modello consuntivo'::text NOT NULL,
    struttura jsonb DEFAULT '{}'::jsonb NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documenti_condominio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documenti_condominio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    url_storage text NOT NULL,
    testo_estratto text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    data_documento date,
    CONSTRAINT documenti_condominio_tipo_check CHECK ((tipo = ANY (ARRAY['regolamento'::text, 'tabella_millesimale_doc'::text, 'verbale'::text, 'contratto'::text, 'certificazione'::text, 'altro'::text])))
);


--
-- Name: esercizi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esercizi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    anno integer NOT NULL,
    data_inizio date NOT NULL,
    data_fine date NOT NULL,
    stato text DEFAULT 'aperto'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    saldo_iniziale_cassa numeric,
    tipo text DEFAULT 'ordinario'::text,
    CONSTRAINT esercizi_stato_check CHECK ((stato = ANY (ARRAY['bozza'::text, 'aperto'::text, 'chiuso'::text]))),
    CONSTRAINT esercizi_tipo_check CHECK ((tipo = ANY (ARRAY['ordinario'::text, 'straordinario'::text])))
);


--
-- Name: estratto_conto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estratto_conto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    data_movimento date NOT NULL,
    causale text NOT NULL,
    importo numeric(12,2) NOT NULL,
    saldo numeric(12,2),
    tipo text DEFAULT 'uscita'::text,
    fornitore_rilevato text,
    riferimento_esterno text,
    fonte_import text,
    ai_processed boolean DEFAULT false,
    riconciliato boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pagante_rilevato text,
    CONSTRAINT estratto_conto_tipo_check CHECK ((tipo = ANY (ARRAY['entrata'::text, 'uscita'::text, 'giroconto'::text])))
);


--
-- Name: fatture_fornitori; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fatture_fornitori (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    spesa_id uuid,
    fornitore text NOT NULL,
    numero_fattura text,
    data_fattura date NOT NULL,
    data_scadenza date,
    importo_totale numeric(12,2) NOT NULL,
    importo_iva numeric(12,2) DEFAULT 0,
    importo_netto numeric(12,2),
    descrizione text,
    categoria text,
    stato text DEFAULT 'attesa'::text,
    pdf_url text,
    pdf_testo_estratto text,
    ai_dati_estratti jsonb,
    riconciliata boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ritenuta_acconto numeric,
    f24_url text,
    f24_caricato_at timestamp with time zone,
    fornitore_id uuid,
    CONSTRAINT fatture_fornitori_stato_check CHECK ((stato = ANY (ARRAY['attesa'::text, 'pagata'::text, 'contestata'::text, 'annullata'::text])))
);


--
-- Name: fornitori; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fornitori (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    ragione_sociale text NOT NULL,
    partita_iva text,
    codice_fiscale text,
    indirizzo text,
    citta text,
    cap text,
    provincia text,
    email text,
    telefono text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inbox_documenti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbox_documenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amministratore_id uuid NOT NULL,
    condominio_id uuid,
    file_path text,
    file_name text,
    email_mittente text,
    email_oggetto text,
    data_ricezione timestamp with time zone DEFAULT timezone('utc'::text, now()),
    stato text DEFAULT 'nuovo'::text NOT NULL,
    dati_estratti jsonb,
    spesa_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    tipo text DEFAULT 'spesa'::text NOT NULL,
    email_corpo text,
    letta_il timestamp with time zone,
    CONSTRAINT inbox_documenti_stato_check CHECK ((stato = ANY (ARRAY['nuovo'::text, 'rilevato'::text, 'da_smistare'::text, 'inserito'::text, 'elaborato'::text, 'conguagliato'::text, 'scartato'::text]))),
    CONSTRAINT inbox_documenti_tipo_check CHECK ((tipo = ANY (ARRAY['spesa'::text, 'subentro'::text, 'messaggio'::text])))
);


--
-- Name: millesimi_unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.millesimi_unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tabella_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    valore numeric(10,4) DEFAULT 0 NOT NULL
);


--
-- Name: occupanti_unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occupanti_unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unita_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    ruolo text NOT NULL,
    data_inizio date DEFAULT CURRENT_DATE NOT NULL,
    data_fine date,
    attivo boolean DEFAULT true NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT occupanti_unita_ruolo_check CHECK ((ruolo = ANY (ARRAY['proprietario'::text, 'inquilino'::text])))
);


--
-- Name: COLUMN occupanti_unita.data_inizio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.occupanti_unita.data_inizio IS 'Data in cui l occupant subentra/inizia a possedere l unita';


--
-- Name: COLUMN occupanti_unita.data_fine; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.occupanti_unita.data_fine IS 'Data in cui termina l occupazione/proprieta dell unita';


--
-- Name: persone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persone (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    cognome text NOT NULL,
    codice_fiscale text,
    data_nascita date,
    luogo_nascita text,
    email text,
    telefono text,
    telefono_alt text,
    indirizzo text,
    cap text,
    citta text,
    provincia text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: preventivi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preventivi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    esercizio_id uuid NOT NULL,
    stato text DEFAULT 'bozza'::text NOT NULL,
    totale numeric(12,2) DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT preventivi_stato_check CHECK ((stato = ANY (ARRAY['bozza'::text, 'approvato'::text])))
);


--
-- Name: preventivo_voci; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preventivo_voci (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    preventivo_id uuid NOT NULL,
    descrizione text NOT NULL,
    categoria text,
    importo numeric(12,2) DEFAULT 0 NOT NULL,
    criterio text DEFAULT 'millesimi'::text NOT NULL,
    tabella_millesimale_id uuid,
    ordine integer DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT preventivo_voci_check CHECK (((criterio <> 'millesimi'::text) OR (tabella_millesimale_id IS NOT NULL))),
    CONSTRAINT preventivo_voci_criterio_check CHECK ((criterio = ANY (ARRAY['millesimi'::text, 'parti_uguali'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    nome text,
    cognome text,
    telefono text,
    studio_nome text,
    piva text,
    indirizzo text,
    citta text,
    cap text,
    piano text DEFAULT 'trial'::text,
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_subscription_id text,
    stripe_status text DEFAULT 'inactive'::text,
    stripe_condomini_item_id text,
    dpa_accepted_at timestamp with time zone,
    dpa_ip text,
    studio_indirizzo text,
    studio_contatti text,
    logo_base64 text,
    is_superadmin boolean DEFAULT false,
    partner_postale_nome text DEFAULT 'nessuno'::text,
    partner_postale_api_key text,
    partner_postale_mittente_id text,
    notification_settings jsonb DEFAULT '{"f24_ritenute": {"enabled": true}, "rate_scadute": {"enabled": true, "giorni_dopo_scadenza": 10}, "esercizio_in_scadenza": {"enabled": true, "giorni_prima": 30}, "movimenti_non_riconciliati": {"enabled": false, "giorni_tolleranza": 15}}'::jsonb,
    referral_code text DEFAULT public.generate_referral_code() NOT NULL,
    inbound_email_prefix text,
    is_beta_tester boolean DEFAULT false,
    ragione_sociale text,
    partita_iva text,
    codice_fiscale text,
    CONSTRAINT check_partner_postale_nome CHECK ((partner_postale_nome = ANY (ARRAY['nessuno'::text, 'multidialogo_simulato'::text, 'multidialogo'::text])))
);


--
-- Name: COLUMN profiles.partner_postale_nome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.partner_postale_nome IS 'Partner postale opzionale scelto (nessuno, multidialogo_simulato, multidialogo)';


--
-- Name: COLUMN profiles.partner_postale_api_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.partner_postale_api_key IS 'Chiave API del partner postale';


--
-- Name: COLUMN profiles.partner_postale_mittente_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.partner_postale_mittente_id IS 'ID del mittente registrato sul portale del partner postale';


--
-- Name: rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    esercizio_id uuid NOT NULL,
    condominio_id uuid NOT NULL,
    numero_rata integer NOT NULL,
    data_scadenza date NOT NULL,
    percentuale numeric(5,2) DEFAULT 25 NOT NULL,
    note text,
    preventivo_id uuid,
    descrizione text,
    CONSTRAINT rate_numero_rata_check CHECK (((numero_rata >= 1) AND (numero_rata <= 4)))
);


--
-- Name: rate_unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rata_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    condominio_id uuid NOT NULL,
    importo numeric(12,2) DEFAULT 0 NOT NULL,
    importo_pagato numeric(12,2) DEFAULT 0 NOT NULL,
    data_pagamento date,
    stato text DEFAULT 'non_pagata'::text NOT NULL,
    modificato_manualmente boolean DEFAULT false NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_unita_stato_check CHECK ((stato = ANY (ARRAY['non_pagata'::text, 'parziale'::text, 'pagata'::text, 'sovra_pagata'::text])))
);


--
-- Name: referral_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    codice_campagna text NOT NULL,
    sconto_importo numeric(10,2) DEFAULT 10.00 NOT NULL,
    attiva boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid,
    campaign_id uuid,
    referred_email text NOT NULL,
    sconto_valore numeric(10,2) NOT NULL,
    stato text DEFAULT 'registrato'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    validated_at timestamp with time zone,
    applied_at timestamp with time zone,
    CONSTRAINT referrals_stato_check CHECK ((stato = ANY (ARRAY['registrato'::text, 'convalidato'::text, 'applicato'::text])))
);


--
-- Name: riconciliazioni; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.riconciliazioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    movimento_id uuid NOT NULL,
    fattura_id uuid NOT NULL,
    confidence_score numeric(4,2),
    metodo text DEFAULT 'ai'::text,
    stato text DEFAULT 'suggerita'::text,
    note text,
    confermata_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT riconciliazioni_metodo_check CHECK ((metodo = ANY (ARRAY['ai'::text, 'manuale'::text]))),
    CONSTRAINT riconciliazioni_stato_check CHECK ((stato = ANY (ARRAY['suggerita'::text, 'confermata'::text, 'rifiutata'::text])))
);


--
-- Name: riconciliazioni_incassi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.riconciliazioni_incassi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    movimento_id uuid NOT NULL,
    rata_unita_id uuid NOT NULL,
    importo_assegnato numeric NOT NULL,
    confidence_score numeric,
    metodo text DEFAULT 'ai'::text,
    stato text DEFAULT 'suggerita'::text,
    note text,
    confermata_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT riconciliazioni_incassi_metodo_check CHECK ((metodo = ANY (ARRAY['ai'::text, 'manuale'::text]))),
    CONSTRAINT riconciliazioni_incassi_stato_check CHECK ((stato = ANY (ARRAY['suggerita'::text, 'confermata'::text, 'rifiutata'::text])))
);


--
-- Name: ripartizioni; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ripartizioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spesa_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    importo numeric(12,2) NOT NULL,
    millesimi_usati numeric(10,4),
    criterio_applicato text,
    importo_override numeric(12,2),
    note_subentro text,
    subentro_segnalato boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    override_manuale boolean DEFAULT false,
    giorni_totali integer,
    giorni_competenza integer,
    note_override text
);


--
-- Name: saldi_iniziali_unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saldi_iniziali_unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    esercizio_id uuid NOT NULL,
    unita_id uuid NOT NULL,
    condominio_id uuid NOT NULL,
    saldo numeric DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: segnalazioni_condominio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segnalazioni_condominio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    unita_id uuid,
    persona_id uuid,
    titolo text NOT NULL,
    descrizione text NOT NULL,
    stato text DEFAULT 'nuovo'::text NOT NULL,
    tipo text DEFAULT 'manutenzione'::text NOT NULL,
    inbox_documento_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    data_chiusura timestamp with time zone,
    CONSTRAINT segnalazioni_condominio_stato_check CHECK ((stato = ANY (ARRAY['nuovo'::text, 'in_corso'::text, 'risolto'::text, 'chiuso'::text]))),
    CONSTRAINT segnalazioni_condominio_tipo_check CHECK ((tipo = ANY (ARRAY['manutenzione'::text, 'sinistro'::text])))
);


--
-- Name: spese; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spese (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    esercizio_id uuid NOT NULL,
    condominio_id uuid NOT NULL,
    descrizione text NOT NULL,
    importo numeric(12,2) NOT NULL,
    data_spesa date NOT NULL,
    categoria text DEFAULT 'ordinaria'::text NOT NULL,
    tipo_lavoro text DEFAULT 'ordinario'::text NOT NULL,
    criterio text DEFAULT 'millesimi'::text NOT NULL,
    tabella_millesimale_id uuid,
    percentuale_millesimi numeric(5,2) DEFAULT 100,
    fornitore text,
    numero_fattura text,
    note text,
    suggerimento_ai jsonb,
    criterio_override boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT spese_categoria_check CHECK ((categoria = ANY (ARRAY['ordinaria'::text, 'straordinaria'::text, 'manutenzione'::text, 'utenze'::text, 'assicurazione'::text, 'altro'::text]))),
    CONSTRAINT spese_criterio_check CHECK ((criterio = ANY (ARRAY['millesimi'::text, 'quota_fissa'::text, 'mista'::text, 'manuale'::text]))),
    CONSTRAINT spese_tipo_lavoro_check CHECK ((tipo_lavoro = ANY (ARRAY['ordinario'::text, 'straordinario'::text])))
);


--
-- Name: subentri_contabilizzazione; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subentri_contabilizzazione (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inbox_documento_id uuid,
    unita_id uuid NOT NULL,
    persona_uscente_id uuid,
    persona_entrante_id uuid NOT NULL,
    data_subentro date NOT NULL,
    stato_contabile text DEFAULT 'in_attesa'::text NOT NULL,
    saldo_conguaglio numeric(10,2) DEFAULT 0.00,
    accollato_a_entrante boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subentri_contabilizzazione_stato_contabile_check CHECK ((stato_contabile = ANY (ARRAY['in_attesa'::text, 'completato'::text, 'bypassato'::text])))
);


--
-- Name: tabelle_millesimali; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabelle_millesimali (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    nome text NOT NULL,
    descrizione text,
    totale_millesimi numeric(10,4) DEFAULT 1000,
    tipo_lavoro text DEFAULT 'entrambi'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tabelle_millesimali_tipo_lavoro_check CHECK ((tipo_lavoro = ANY (ARRAY['ordinario'::text, 'straordinario'::text, 'entrambi'::text])))
);


--
-- Name: tickets_assistenza; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets_assistenza (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    utente_id uuid DEFAULT auth.uid() NOT NULL,
    titolo text NOT NULL,
    messaggio text NOT NULL,
    risposta_admin text,
    stato text DEFAULT 'aperto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tickets_assistenza_stato_check CHECK ((stato = ANY (ARRAY['aperto'::text, 'chiuso'::text])))
);


--
-- Name: unita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condominio_id uuid NOT NULL,
    numero text NOT NULL,
    tipo text DEFAULT 'appartamento'::text NOT NULL,
    scala text,
    piano integer,
    mq numeric(8,2),
    millesimi numeric(8,4),
    stato text DEFAULT 'attiva'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unita_stato_check CHECK ((stato = ANY (ARRAY['attiva'::text, 'venduta'::text, 'sfitta'::text, 'altro'::text]))),
    CONSTRAINT unita_tipo_check CHECK ((tipo = ANY (ARRAY['appartamento'::text, 'box'::text, 'cantina'::text, 'negozio'::text, 'ufficio'::text, 'altro'::text])))
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    user_id uuid NOT NULL,
    session_id text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_call_log ai_call_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_call_log
    ADD CONSTRAINT ai_call_log_pkey PRIMARY KEY (id);


--
-- Name: assemblee_odg assemblee_odg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_odg
    ADD CONSTRAINT assemblee_odg_pkey PRIMARY KEY (id);


--
-- Name: assemblee assemblee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee
    ADD CONSTRAINT assemblee_pkey PRIMARY KEY (id);


--
-- Name: assemblee_presenze assemblee_presenze_assemblea_id_unita_id_persona_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_assemblea_id_unita_id_persona_id_key UNIQUE (assemblea_id, unita_id, persona_id);


--
-- Name: assemblee_presenze assemblee_presenze_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_pkey PRIMARY KEY (id);


--
-- Name: assemblee_voti assemblee_voti_odg_id_unita_id_persona_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_voti
    ADD CONSTRAINT assemblee_voti_odg_id_unita_id_persona_id_key UNIQUE (odg_id, unita_id, persona_id);


--
-- Name: assemblee_voti assemblee_voti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_voti
    ADD CONSTRAINT assemblee_voti_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: chat_assistenza_logs chat_assistenza_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_assistenza_logs
    ADD CONSTRAINT chat_assistenza_logs_pkey PRIMARY KEY (id);


--
-- Name: gemini_rate_limit claude_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gemini_rate_limit
    ADD CONSTRAINT claude_rate_limit_pkey PRIMARY KEY (id);


--
-- Name: collaboratori_condomini collaboratori_condomini_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_condomini
    ADD CONSTRAINT collaboratori_condomini_pkey PRIMARY KEY (collaboratore_id, condominio_id);


--
-- Name: collaboratori_studio collaboratori_studio_amministratore_id_email_collaboratore_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_studio
    ADD CONSTRAINT collaboratori_studio_amministratore_id_email_collaboratore_key UNIQUE (amministratore_id, email_collaboratore);


--
-- Name: collaboratori_studio collaboratori_studio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_studio
    ADD CONSTRAINT collaboratori_studio_pkey PRIMARY KEY (id);


--
-- Name: comunicazioni comunicazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunicazioni
    ADD CONSTRAINT comunicazioni_pkey PRIMARY KEY (id);


--
-- Name: condomini condomini_codice_app_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condomini
    ADD CONSTRAINT condomini_codice_app_key UNIQUE (codice_app);


--
-- Name: condomini condomini_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condomini
    ADD CONSTRAINT condomini_pkey PRIMARY KEY (id);


--
-- Name: condominio_servizi_telematici condominio_servizi_telematici_condominio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condominio_servizi_telematici
    ADD CONSTRAINT condominio_servizi_telematici_condominio_id_key UNIQUE (condominio_id);


--
-- Name: condominio_servizi_telematici condominio_servizi_telematici_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condominio_servizi_telematici
    ADD CONSTRAINT condominio_servizi_telematici_pkey PRIMARY KEY (id);


--
-- Name: config_pagante_unita config_pagante_unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_pagante_unita
    ADD CONSTRAINT config_pagante_unita_pkey PRIMARY KEY (id);


--
-- Name: config_pagante_unita config_pagante_unita_unita_id_esercizio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_pagante_unita
    ADD CONSTRAINT config_pagante_unita_unita_id_esercizio_id_key UNIQUE (unita_id, esercizio_id);


--
-- Name: consuntivo_template consuntivo_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consuntivo_template
    ADD CONSTRAINT consuntivo_template_pkey PRIMARY KEY (id);


--
-- Name: documenti_condominio documenti_condominio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documenti_condominio
    ADD CONSTRAINT documenti_condominio_pkey PRIMARY KEY (id);


--
-- Name: esercizi esercizi_condominio_id_anno_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esercizi
    ADD CONSTRAINT esercizi_condominio_id_anno_key UNIQUE (condominio_id, anno);


--
-- Name: esercizi esercizi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esercizi
    ADD CONSTRAINT esercizi_pkey PRIMARY KEY (id);


--
-- Name: estratto_conto estratto_conto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estratto_conto
    ADD CONSTRAINT estratto_conto_pkey PRIMARY KEY (id);


--
-- Name: fatture_fornitori fatture_fornitori_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatture_fornitori
    ADD CONSTRAINT fatture_fornitori_pkey PRIMARY KEY (id);


--
-- Name: fornitori fornitori_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fornitori
    ADD CONSTRAINT fornitori_pkey PRIMARY KEY (id);


--
-- Name: inbox_documenti inbox_documenti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_documenti
    ADD CONSTRAINT inbox_documenti_pkey PRIMARY KEY (id);


--
-- Name: millesimi_unita millesimi_unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.millesimi_unita
    ADD CONSTRAINT millesimi_unita_pkey PRIMARY KEY (id);


--
-- Name: millesimi_unita millesimi_unita_tabella_id_unita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.millesimi_unita
    ADD CONSTRAINT millesimi_unita_tabella_id_unita_id_key UNIQUE (tabella_id, unita_id);


--
-- Name: occupanti_unita occupanti_unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupanti_unita
    ADD CONSTRAINT occupanti_unita_pkey PRIMARY KEY (id);


--
-- Name: persone persone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persone
    ADD CONSTRAINT persone_pkey PRIMARY KEY (id);


--
-- Name: preventivi preventivi_esercizio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivi
    ADD CONSTRAINT preventivi_esercizio_id_key UNIQUE (esercizio_id);


--
-- Name: preventivi preventivi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivi
    ADD CONSTRAINT preventivi_pkey PRIMARY KEY (id);


--
-- Name: preventivo_voci preventivo_voci_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivo_voci
    ADD CONSTRAINT preventivo_voci_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_inbound_email_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_inbound_email_prefix_key UNIQUE (inbound_email_prefix);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: rate rate_esercizio_id_numero_rata_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate
    ADD CONSTRAINT rate_esercizio_id_numero_rata_key UNIQUE (esercizio_id, numero_rata);


--
-- Name: rate rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate
    ADD CONSTRAINT rate_pkey PRIMARY KEY (id);


--
-- Name: rate_unita rate_unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_unita
    ADD CONSTRAINT rate_unita_pkey PRIMARY KEY (id);


--
-- Name: rate_unita rate_unita_rata_id_unita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_unita
    ADD CONSTRAINT rate_unita_rata_id_unita_id_key UNIQUE (rata_id, unita_id);


--
-- Name: referral_campaigns referral_campaigns_codice_campagna_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_campaigns
    ADD CONSTRAINT referral_campaigns_codice_campagna_key UNIQUE (codice_campagna);


--
-- Name: referral_campaigns referral_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_campaigns
    ADD CONSTRAINT referral_campaigns_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: riconciliazioni_incassi riconciliazioni_incassi_movimento_id_rata_unita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni_incassi
    ADD CONSTRAINT riconciliazioni_incassi_movimento_id_rata_unita_id_key UNIQUE (movimento_id, rata_unita_id);


--
-- Name: riconciliazioni_incassi riconciliazioni_incassi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni_incassi
    ADD CONSTRAINT riconciliazioni_incassi_pkey PRIMARY KEY (id);


--
-- Name: riconciliazioni riconciliazioni_movimento_id_fattura_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_movimento_id_fattura_id_key UNIQUE (movimento_id, fattura_id);


--
-- Name: riconciliazioni riconciliazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_pkey PRIMARY KEY (id);


--
-- Name: ripartizioni ripartizioni_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ripartizioni
    ADD CONSTRAINT ripartizioni_pkey PRIMARY KEY (id);


--
-- Name: ripartizioni ripartizioni_spesa_id_unita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ripartizioni
    ADD CONSTRAINT ripartizioni_spesa_id_unita_id_key UNIQUE (spesa_id, unita_id);


--
-- Name: saldi_iniziali_unita saldi_iniziali_unita_esercizio_id_unita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saldi_iniziali_unita
    ADD CONSTRAINT saldi_iniziali_unita_esercizio_id_unita_id_key UNIQUE (esercizio_id, unita_id);


--
-- Name: saldi_iniziali_unita saldi_iniziali_unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saldi_iniziali_unita
    ADD CONSTRAINT saldi_iniziali_unita_pkey PRIMARY KEY (id);


--
-- Name: segnalazioni_condominio segnalazioni_condominio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segnalazioni_condominio
    ADD CONSTRAINT segnalazioni_condominio_pkey PRIMARY KEY (id);


--
-- Name: spese spese_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spese
    ADD CONSTRAINT spese_pkey PRIMARY KEY (id);


--
-- Name: subentri_contabilizzazione subentri_contabilizzazione_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subentri_contabilizzazione
    ADD CONSTRAINT subentri_contabilizzazione_pkey PRIMARY KEY (id);


--
-- Name: tabelle_millesimali tabelle_millesimali_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelle_millesimali
    ADD CONSTRAINT tabelle_millesimali_pkey PRIMARY KEY (id);


--
-- Name: tickets_assistenza tickets_assistenza_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_assistenza
    ADD CONSTRAINT tickets_assistenza_pkey PRIMARY KEY (id);


--
-- Name: unita unita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unita
    ADD CONSTRAINT unita_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (user_id);


--
-- Name: idx_ai_call_log_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_call_log_timestamp ON public.ai_call_log USING btree ("timestamp");


--
-- Name: idx_ai_call_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_call_log_user_id ON public.ai_call_log USING btree (user_id);


--
-- Name: idx_audit_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_categoria ON public.audit_log USING btree (categoria);


--
-- Name: idx_audit_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_condominio ON public.audit_log USING btree (condominio_id);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_tabella; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_tabella ON public.audit_log USING btree (tabella_modificata);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_claude_rate_limit_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claude_rate_limit_user_time ON public.gemini_rate_limit USING btree (user_id, created_at DESC);


--
-- Name: idx_condomini_amministratore; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_condomini_amministratore ON public.condomini USING btree (amministratore_id);


--
-- Name: idx_condomini_citta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_condomini_citta ON public.condomini USING btree (citta);


--
-- Name: idx_condomini_stato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_condomini_stato ON public.condomini USING btree (stato);


--
-- Name: idx_consuntivo_template_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consuntivo_template_admin ON public.consuntivo_template USING btree (amministratore_id);


--
-- Name: idx_estratto_conto_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estratto_conto_condominio ON public.estratto_conto USING btree (condominio_id);


--
-- Name: idx_estratto_conto_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estratto_conto_data ON public.estratto_conto USING btree (data_movimento);


--
-- Name: idx_fatture_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fatture_condominio ON public.fatture_fornitori USING btree (condominio_id);


--
-- Name: idx_fatture_stato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fatture_stato ON public.fatture_fornitori USING btree (stato);


--
-- Name: idx_occupanti_attivo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occupanti_attivo ON public.occupanti_unita USING btree (attivo);


--
-- Name: idx_occupanti_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occupanti_persona ON public.occupanti_unita USING btree (persona_id);


--
-- Name: idx_occupanti_unita; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occupanti_unita ON public.occupanti_unita USING btree (unita_id);


--
-- Name: idx_persone_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persone_user ON public.persone USING btree (user_id);


--
-- Name: idx_prev_voci_preventivo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prev_voci_preventivo ON public.preventivo_voci USING btree (preventivo_id);


--
-- Name: idx_preventivi_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preventivi_condominio ON public.preventivi USING btree (condominio_id);


--
-- Name: idx_preventivi_esercizio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preventivi_esercizio ON public.preventivi USING btree (esercizio_id);


--
-- Name: idx_rate_preventivo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_preventivo ON public.rate USING btree (preventivo_id);


--
-- Name: idx_rate_unita_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_unita_condominio ON public.rate_unita USING btree (condominio_id);


--
-- Name: idx_rate_unita_rata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_unita_rata ON public.rate_unita USING btree (rata_id);


--
-- Name: idx_rate_unita_unita; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_unita_unita ON public.rate_unita USING btree (unita_id);


--
-- Name: idx_ric_incassi_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ric_incassi_condominio ON public.riconciliazioni_incassi USING btree (condominio_id);


--
-- Name: idx_ric_incassi_movimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ric_incassi_movimento ON public.riconciliazioni_incassi USING btree (movimento_id);


--
-- Name: idx_ric_incassi_rata_unita; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ric_incassi_rata_unita ON public.riconciliazioni_incassi USING btree (rata_unita_id);


--
-- Name: idx_riconciliazioni_fattura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_riconciliazioni_fattura ON public.riconciliazioni USING btree (fattura_id);


--
-- Name: idx_riconciliazioni_movimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_riconciliazioni_movimento ON public.riconciliazioni USING btree (movimento_id);


--
-- Name: idx_unita_condominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unita_condominio ON public.unita USING btree (condominio_id);


--
-- Name: profiles_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);


--
-- Name: profiles_piano_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_piano_idx ON public.profiles USING btree (piano);


--
-- Name: documenti_condominio audit_documenti; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_documenti AFTER INSERT OR DELETE OR UPDATE ON public.documenti_condominio FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: esercizi audit_esercizi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_esercizi AFTER INSERT OR DELETE OR UPDATE ON public.esercizi FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: millesimi_unita audit_millesimi_unita; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_millesimi_unita AFTER INSERT OR DELETE OR UPDATE ON public.millesimi_unita FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: occupanti_unita audit_occupanti_unita; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_occupanti_unita AFTER INSERT OR DELETE OR UPDATE ON public.occupanti_unita FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: persone audit_persone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_persone AFTER INSERT OR DELETE OR UPDATE ON public.persone FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: ripartizioni audit_ripartizioni; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_ripartizioni AFTER INSERT OR DELETE OR UPDATE ON public.ripartizioni FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: spese audit_spese; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_spese AFTER INSERT OR DELETE OR UPDATE ON public.spese FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: tabelle_millesimali audit_tabelle_millesimali; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_tabelle_millesimali AFTER INSERT OR DELETE OR UPDATE ON public.tabelle_millesimali FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: unita audit_unita; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_unita AFTER INSERT OR DELETE OR UPDATE ON public.unita FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


--
-- Name: condomini condomini_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER condomini_updated_at BEFORE UPDATE ON public.condomini FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles trg_check_piano_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_piano_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_piano_update();


--
-- Name: profiles trg_check_stripe_fields_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_stripe_fields_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_stripe_fields_update();


--
-- Name: documenti_condominio trg_updated_at_documenti; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_documenti BEFORE UPDATE ON public.documenti_condominio FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: esercizi trg_updated_at_esercizi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_esercizi BEFORE UPDATE ON public.esercizi FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: spese trg_updated_at_spese; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_spese BEFORE UPDATE ON public.spese FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tabelle_millesimali trg_updated_at_tabelle_millesimali; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_tabelle_millesimali BEFORE UPDATE ON public.tabelle_millesimali FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ai_call_log ai_call_log_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_call_log
    ADD CONSTRAINT ai_call_log_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE SET NULL;


--
-- Name: ai_call_log ai_call_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_call_log
    ADD CONSTRAINT ai_call_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assemblee assemblee_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee
    ADD CONSTRAINT assemblee_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: assemblee_odg assemblee_odg_assemblea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_odg
    ADD CONSTRAINT assemblee_odg_assemblea_id_fkey FOREIGN KEY (assemblea_id) REFERENCES public.assemblee(id) ON DELETE CASCADE;


--
-- Name: assemblee_odg assemblee_odg_tabella_millesimale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_odg
    ADD CONSTRAINT assemblee_odg_tabella_millesimale_id_fkey FOREIGN KEY (tabella_millesimale_id) REFERENCES public.tabelle_millesimali(id) ON DELETE SET NULL;


--
-- Name: assemblee_presenze assemblee_presenze_assemblea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_assemblea_id_fkey FOREIGN KEY (assemblea_id) REFERENCES public.assemblee(id) ON DELETE CASCADE;


--
-- Name: assemblee_presenze assemblee_presenze_delegato_a_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_delegato_a_persona_id_fkey FOREIGN KEY (delegato_a_persona_id) REFERENCES public.persone(id) ON DELETE SET NULL;


--
-- Name: assemblee_presenze assemblee_presenze_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persone(id) ON DELETE CASCADE;


--
-- Name: assemblee_presenze assemblee_presenze_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_presenze
    ADD CONSTRAINT assemblee_presenze_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: assemblee_voti assemblee_voti_odg_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_voti
    ADD CONSTRAINT assemblee_voti_odg_id_fkey FOREIGN KEY (odg_id) REFERENCES public.assemblee_odg(id) ON DELETE CASCADE;


--
-- Name: assemblee_voti assemblee_voti_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_voti
    ADD CONSTRAINT assemblee_voti_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persone(id) ON DELETE CASCADE;


--
-- Name: assemblee_voti assemblee_voti_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblee_voti
    ADD CONSTRAINT assemblee_voti_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_assistenza_logs chat_assistenza_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_assistenza_logs
    ADD CONSTRAINT chat_assistenza_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collaboratori_condomini collaboratori_condomini_collaboratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_condomini
    ADD CONSTRAINT collaboratori_condomini_collaboratore_id_fkey FOREIGN KEY (collaboratore_id) REFERENCES public.collaboratori_studio(id) ON DELETE CASCADE;


--
-- Name: collaboratori_condomini collaboratori_condomini_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_condomini
    ADD CONSTRAINT collaboratori_condomini_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: collaboratori_studio collaboratori_studio_amministratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_studio
    ADD CONSTRAINT collaboratori_studio_amministratore_id_fkey FOREIGN KEY (amministratore_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collaboratori_studio collaboratori_studio_utente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboratori_studio
    ADD CONSTRAINT collaboratori_studio_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: comunicazioni comunicazioni_amministratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunicazioni
    ADD CONSTRAINT comunicazioni_amministratore_id_fkey FOREIGN KEY (amministratore_id) REFERENCES auth.users(id);


--
-- Name: comunicazioni comunicazioni_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comunicazioni
    ADD CONSTRAINT comunicazioni_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: condomini condomini_amministratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condomini
    ADD CONSTRAINT condomini_amministratore_id_fkey FOREIGN KEY (amministratore_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: condomini condomini_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condomini
    ADD CONSTRAINT condomini_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: condominio_servizi_telematici condominio_servizi_telematici_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condominio_servizi_telematici
    ADD CONSTRAINT condominio_servizi_telematici_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: condominio_servizi_telematici condominio_servizi_telematici_verbale_approvazione_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.condominio_servizi_telematici
    ADD CONSTRAINT condominio_servizi_telematici_verbale_approvazione_id_fkey FOREIGN KEY (verbale_approvazione_id) REFERENCES public.documenti_condominio(id) ON DELETE SET NULL;


--
-- Name: config_pagante_unita config_pagante_unita_esercizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_pagante_unita
    ADD CONSTRAINT config_pagante_unita_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES public.esercizi(id) ON DELETE CASCADE;


--
-- Name: config_pagante_unita config_pagante_unita_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_pagante_unita
    ADD CONSTRAINT config_pagante_unita_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: consuntivo_template consuntivo_template_amministratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consuntivo_template
    ADD CONSTRAINT consuntivo_template_amministratore_id_fkey FOREIGN KEY (amministratore_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: documenti_condominio documenti_condominio_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documenti_condominio
    ADD CONSTRAINT documenti_condominio_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: esercizi esercizi_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esercizi
    ADD CONSTRAINT esercizi_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: estratto_conto estratto_conto_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estratto_conto
    ADD CONSTRAINT estratto_conto_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: estratto_conto estratto_conto_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estratto_conto
    ADD CONSTRAINT estratto_conto_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fatture_fornitori fatture_fornitori_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatture_fornitori
    ADD CONSTRAINT fatture_fornitori_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: fatture_fornitori fatture_fornitori_fornitore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatture_fornitori
    ADD CONSTRAINT fatture_fornitori_fornitore_id_fkey FOREIGN KEY (fornitore_id) REFERENCES public.fornitori(id) ON DELETE SET NULL;


--
-- Name: fatture_fornitori fatture_fornitori_spesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatture_fornitori
    ADD CONSTRAINT fatture_fornitori_spesa_id_fkey FOREIGN KEY (spesa_id) REFERENCES public.spese(id) ON DELETE SET NULL;


--
-- Name: fatture_fornitori fatture_fornitori_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatture_fornitori
    ADD CONSTRAINT fatture_fornitori_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fornitori fornitori_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fornitori
    ADD CONSTRAINT fornitori_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: inbox_documenti inbox_documenti_amministratore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_documenti
    ADD CONSTRAINT inbox_documenti_amministratore_id_fkey FOREIGN KEY (amministratore_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: inbox_documenti inbox_documenti_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_documenti
    ADD CONSTRAINT inbox_documenti_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE SET NULL;


--
-- Name: inbox_documenti inbox_documenti_spesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_documenti
    ADD CONSTRAINT inbox_documenti_spesa_id_fkey FOREIGN KEY (spesa_id) REFERENCES public.spese(id) ON DELETE SET NULL;


--
-- Name: millesimi_unita millesimi_unita_tabella_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.millesimi_unita
    ADD CONSTRAINT millesimi_unita_tabella_id_fkey FOREIGN KEY (tabella_id) REFERENCES public.tabelle_millesimali(id) ON DELETE CASCADE;


--
-- Name: millesimi_unita millesimi_unita_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.millesimi_unita
    ADD CONSTRAINT millesimi_unita_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: occupanti_unita occupanti_unita_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupanti_unita
    ADD CONSTRAINT occupanti_unita_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persone(id) ON DELETE CASCADE;


--
-- Name: occupanti_unita occupanti_unita_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupanti_unita
    ADD CONSTRAINT occupanti_unita_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: persone persone_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persone
    ADD CONSTRAINT persone_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: preventivi preventivi_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivi
    ADD CONSTRAINT preventivi_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: preventivi preventivi_esercizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivi
    ADD CONSTRAINT preventivi_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES public.esercizi(id) ON DELETE CASCADE;


--
-- Name: preventivo_voci preventivo_voci_preventivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivo_voci
    ADD CONSTRAINT preventivo_voci_preventivo_id_fkey FOREIGN KEY (preventivo_id) REFERENCES public.preventivi(id) ON DELETE CASCADE;


--
-- Name: preventivo_voci preventivo_voci_tabella_millesimale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preventivo_voci
    ADD CONSTRAINT preventivo_voci_tabella_millesimale_id_fkey FOREIGN KEY (tabella_millesimale_id) REFERENCES public.tabelle_millesimali(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rate rate_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate
    ADD CONSTRAINT rate_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: rate rate_esercizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate
    ADD CONSTRAINT rate_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES public.esercizi(id) ON DELETE CASCADE;


--
-- Name: rate rate_preventivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate
    ADD CONSTRAINT rate_preventivo_id_fkey FOREIGN KEY (preventivo_id) REFERENCES public.preventivi(id) ON DELETE CASCADE;


--
-- Name: rate_unita rate_unita_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_unita
    ADD CONSTRAINT rate_unita_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: rate_unita rate_unita_rata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_unita
    ADD CONSTRAINT rate_unita_rata_id_fkey FOREIGN KEY (rata_id) REFERENCES public.rate(id) ON DELETE CASCADE;


--
-- Name: rate_unita rate_unita_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_unita
    ADD CONSTRAINT rate_unita_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.referral_campaigns(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni riconciliazioni_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni riconciliazioni_fattura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_fattura_id_fkey FOREIGN KEY (fattura_id) REFERENCES public.fatture_fornitori(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni_incassi riconciliazioni_incassi_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni_incassi
    ADD CONSTRAINT riconciliazioni_incassi_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni_incassi riconciliazioni_incassi_movimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni_incassi
    ADD CONSTRAINT riconciliazioni_incassi_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.estratto_conto(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni_incassi riconciliazioni_incassi_rata_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni_incassi
    ADD CONSTRAINT riconciliazioni_incassi_rata_unita_id_fkey FOREIGN KEY (rata_unita_id) REFERENCES public.rate_unita(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni riconciliazioni_movimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.estratto_conto(id) ON DELETE CASCADE;


--
-- Name: riconciliazioni riconciliazioni_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riconciliazioni
    ADD CONSTRAINT riconciliazioni_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ripartizioni ripartizioni_spesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ripartizioni
    ADD CONSTRAINT ripartizioni_spesa_id_fkey FOREIGN KEY (spesa_id) REFERENCES public.spese(id) ON DELETE CASCADE;


--
-- Name: ripartizioni ripartizioni_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ripartizioni
    ADD CONSTRAINT ripartizioni_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: saldi_iniziali_unita saldi_iniziali_unita_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saldi_iniziali_unita
    ADD CONSTRAINT saldi_iniziali_unita_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: saldi_iniziali_unita saldi_iniziali_unita_esercizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saldi_iniziali_unita
    ADD CONSTRAINT saldi_iniziali_unita_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES public.esercizi(id) ON DELETE CASCADE;


--
-- Name: saldi_iniziali_unita saldi_iniziali_unita_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saldi_iniziali_unita
    ADD CONSTRAINT saldi_iniziali_unita_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: segnalazioni_condominio segnalazioni_condominio_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segnalazioni_condominio
    ADD CONSTRAINT segnalazioni_condominio_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: segnalazioni_condominio segnalazioni_condominio_inbox_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segnalazioni_condominio
    ADD CONSTRAINT segnalazioni_condominio_inbox_documento_id_fkey FOREIGN KEY (inbox_documento_id) REFERENCES public.inbox_documenti(id) ON DELETE SET NULL;


--
-- Name: segnalazioni_condominio segnalazioni_condominio_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segnalazioni_condominio
    ADD CONSTRAINT segnalazioni_condominio_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persone(id) ON DELETE SET NULL;


--
-- Name: segnalazioni_condominio segnalazioni_condominio_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segnalazioni_condominio
    ADD CONSTRAINT segnalazioni_condominio_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE SET NULL;


--
-- Name: spese spese_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spese
    ADD CONSTRAINT spese_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: spese spese_esercizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spese
    ADD CONSTRAINT spese_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES public.esercizi(id) ON DELETE CASCADE;


--
-- Name: spese spese_tabella_millesimale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spese
    ADD CONSTRAINT spese_tabella_millesimale_id_fkey FOREIGN KEY (tabella_millesimale_id) REFERENCES public.tabelle_millesimali(id);


--
-- Name: subentri_contabilizzazione subentri_contabilizzazione_inbox_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subentri_contabilizzazione
    ADD CONSTRAINT subentri_contabilizzazione_inbox_documento_id_fkey FOREIGN KEY (inbox_documento_id) REFERENCES public.inbox_documenti(id) ON DELETE CASCADE;


--
-- Name: subentri_contabilizzazione subentri_contabilizzazione_persona_entrante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subentri_contabilizzazione
    ADD CONSTRAINT subentri_contabilizzazione_persona_entrante_id_fkey FOREIGN KEY (persona_entrante_id) REFERENCES public.persone(id) ON DELETE CASCADE;


--
-- Name: subentri_contabilizzazione subentri_contabilizzazione_persona_uscente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subentri_contabilizzazione
    ADD CONSTRAINT subentri_contabilizzazione_persona_uscente_id_fkey FOREIGN KEY (persona_uscente_id) REFERENCES public.persone(id) ON DELETE SET NULL;


--
-- Name: subentri_contabilizzazione subentri_contabilizzazione_unita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subentri_contabilizzazione
    ADD CONSTRAINT subentri_contabilizzazione_unita_id_fkey FOREIGN KEY (unita_id) REFERENCES public.unita(id) ON DELETE CASCADE;


--
-- Name: tabelle_millesimali tabelle_millesimali_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelle_millesimali
    ADD CONSTRAINT tabelle_millesimali_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: tickets_assistenza tickets_assistenza_utente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_assistenza
    ADD CONSTRAINT tickets_assistenza_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: unita unita_condominio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unita
    ADD CONSTRAINT unita_condominio_id_fkey FOREIGN KEY (condominio_id) REFERENCES public.condomini(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: condomini Amministratore crea i propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratore crea i propri condomini" ON public.condomini FOR INSERT WITH CHECK ((auth.uid() = amministratore_id));


--
-- Name: condomini Amministratore elimina i propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratore elimina i propri condomini" ON public.condomini FOR DELETE USING ((auth.uid() = amministratore_id));


--
-- Name: condomini Amministratore modifica i propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratore modifica i propri condomini" ON public.condomini FOR UPDATE USING ((auth.uid() = amministratore_id)) WITH CHECK ((auth.uid() = amministratore_id));


--
-- Name: condomini Amministratore vede i propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratore vede i propri condomini" ON public.condomini FOR SELECT USING ((auth.uid() = amministratore_id));


--
-- Name: condominio_servizi_telematici Amministratori possono gestire i servizi telematici dei propri ; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratori possono gestire i servizi telematici dei propri " ON public.condominio_servizi_telematici TO authenticated USING (public.user_owns_condominio(condominio_id)) WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: segnalazioni_condominio Amministratori possono gestire le segnalazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amministratori possono gestire le segnalazioni" ON public.segnalazioni_condominio TO authenticated USING (public.user_owns_condominio(condominio_id));


--
-- Name: collaboratori_studio Gli amministratori gestiscono i propri collaboratori; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli amministratori gestiscono i propri collaboratori" ON public.collaboratori_studio TO authenticated USING ((amministratore_id = auth.uid())) WITH CHECK ((amministratore_id = auth.uid()));


--
-- Name: collaboratori_condomini Gli amministratori gestiscono le associazioni dei propri collab; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli amministratori gestiscono le associazioni dei propri collab" ON public.collaboratori_condomini TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.collaboratori_studio cs
  WHERE ((cs.id = collaboratori_condomini.collaboratore_id) AND (cs.amministratore_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.collaboratori_studio cs
  WHERE ((cs.id = collaboratori_condomini.collaboratore_id) AND (cs.amministratore_id = auth.uid())))));


--
-- Name: subentri_contabilizzazione Gli utenti gestiscono i propri subentri; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli utenti gestiscono i propri subentri" ON public.subentri_contabilizzazione TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = subentri_contabilizzazione.unita_id) AND public.user_owns_condominio(u.condominio_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = subentri_contabilizzazione.unita_id) AND public.user_owns_condominio(u.condominio_id)))));


--
-- Name: inbox_documenti Gli utenti leggono i propri inbox_documenti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli utenti leggono i propri inbox_documenti" ON public.inbox_documenti FOR SELECT TO authenticated USING (((amministratore_id = auth.uid()) OR (amministratore_id IN ( SELECT cs.amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true))))));


--
-- Name: inbox_documenti Gli utenti modificano i propri inbox_documenti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli utenti modificano i propri inbox_documenti" ON public.inbox_documenti TO authenticated USING (((amministratore_id = auth.uid()) OR (amministratore_id IN ( SELECT cs.amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true)))))) WITH CHECK (((amministratore_id = auth.uid()) OR (amministratore_id IN ( SELECT cs.amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true))))));


--
-- Name: user_sessions Gli utenti possono gestire la propria sessione; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gli utenti possono gestire la propria sessione" ON public.user_sessions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: collaboratori_condomini I collaboratori possono leggere le proprie associazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "I collaboratori possono leggere le proprie associazioni" ON public.collaboratori_condomini FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.collaboratori_studio cs
  WHERE ((cs.id = collaboratori_condomini.collaboratore_id) AND ((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email()))))));


--
-- Name: collaboratori_studio I collaboratori vedono la propria associazione; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "I collaboratori vedono la propria associazione" ON public.collaboratori_studio FOR SELECT TO authenticated USING (((email_collaboratore = auth.email()) OR (utente_id = auth.uid())));


--
-- Name: ai_call_log Inserimento log AI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inserimento log AI" ON public.ai_call_log FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_call_log Lettura log AI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lettura log AI" ON public.ai_call_log FOR SELECT USING (((auth.uid() = user_id) OR public.is_superadmin(auth.uid())));


--
-- Name: chat_assistenza_logs Superadmin can read all chat logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin can read all chat logs" ON public.chat_assistenza_logs FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));


--
-- Name: chat_assistenza_logs Users can insert own chat logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own chat logs" ON public.chat_assistenza_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: fornitori Users can manage their own fornitori; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own fornitori" ON public.fornitori USING ((auth.uid() = user_id));


--
-- Name: estratto_conto Users own estratto_conto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users own estratto_conto" ON public.estratto_conto USING ((auth.uid() = user_id));


--
-- Name: riconciliazioni Users own riconciliazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users own riconciliazioni" ON public.riconciliazioni USING ((auth.uid() = user_id));


--
-- Name: ai_call_log Utente inserisce solo i propri log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente inserisce solo i propri log" ON public.ai_call_log FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: assemblee Utente può gestire assemblee dei propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può gestire assemblee dei propri condomini" ON public.assemblee USING (public.user_owns_condominio(condominio_id));


--
-- Name: assemblee_odg Utente può gestire odg delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può gestire odg delle proprie assemblee" ON public.assemblee_odg USING ((EXISTS ( SELECT 1
   FROM public.assemblee a
  WHERE ((a.id = assemblee_odg.assemblea_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: assemblee_presenze Utente può gestire presenze delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può gestire presenze delle proprie assemblee" ON public.assemblee_presenze USING ((EXISTS ( SELECT 1
   FROM public.assemblee a
  WHERE ((a.id = assemblee_presenze.assemblea_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: assemblee_voti Utente può gestire voti delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può gestire voti delle proprie assemblee" ON public.assemblee_voti USING ((EXISTS ( SELECT 1
   FROM (public.assemblee_odg odg
     JOIN public.assemblee a ON ((odg.assemblea_id = a.id)))
  WHERE ((odg.id = assemblee_voti.odg_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: assemblee Utente può vedere assemblee dei propri condomini; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può vedere assemblee dei propri condomini" ON public.assemblee FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: assemblee_odg Utente può vedere odg delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può vedere odg delle proprie assemblee" ON public.assemblee_odg FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.assemblee a
  WHERE ((a.id = assemblee_odg.assemblea_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: assemblee_presenze Utente può vedere presenze delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può vedere presenze delle proprie assemblee" ON public.assemblee_presenze FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.assemblee a
  WHERE ((a.id = assemblee_presenze.assemblea_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: assemblee_voti Utente può vedere voti delle proprie assemblee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente può vedere voti delle proprie assemblee" ON public.assemblee_voti FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.assemblee_odg odg
     JOIN public.assemblee a ON ((odg.assemblea_id = a.id)))
  WHERE ((odg.id = assemblee_voti.odg_id) AND public.user_owns_condominio(a.condominio_id)))));


--
-- Name: ai_call_log Utente vede solo i propri log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente vede solo i propri log" ON public.ai_call_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Utente vede solo il proprio profilo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utente vede solo il proprio profilo" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Utenti e SuperAdmin aggiornano i profili; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utenti e SuperAdmin aggiornano i profili" ON public.profiles FOR UPDATE TO authenticated USING (((auth.uid() = id) OR public.is_superadmin(auth.uid()))) WITH CHECK (((auth.uid() = id) OR public.is_superadmin(auth.uid())));


--
-- Name: ai_call_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;

--
-- Name: assemblee; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assemblee ENABLE ROW LEVEL SECURITY;

--
-- Name: assemblee_odg; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assemblee_odg ENABLE ROW LEVEL SECURITY;

--
-- Name: assemblee_presenze; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assemblee_presenze ENABLE ROW LEVEL SECURITY;

--
-- Name: assemblee_voti; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assemblee_voti ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_assistenza_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_assistenza_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboratori_condomini; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboratori_condomini ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboratori_studio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboratori_studio ENABLE ROW LEVEL SECURITY;

--
-- Name: comunicazioni; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunicazioni ENABLE ROW LEVEL SECURITY;

--
-- Name: condomini; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.condomini ENABLE ROW LEVEL SECURITY;

--
-- Name: condominio_servizi_telematici; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.condominio_servizi_telematici ENABLE ROW LEVEL SECURITY;

--
-- Name: config_pagante_unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.config_pagante_unita ENABLE ROW LEVEL SECURITY;

--
-- Name: consuntivo_template; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consuntivo_template ENABLE ROW LEVEL SECURITY;

--
-- Name: consuntivo_template ct_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ct_delete ON public.consuntivo_template FOR DELETE USING ((amministratore_id = auth.uid()));


--
-- Name: consuntivo_template ct_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ct_insert ON public.consuntivo_template FOR INSERT WITH CHECK ((amministratore_id = auth.uid()));


--
-- Name: consuntivo_template ct_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ct_select ON public.consuntivo_template FOR SELECT USING ((amministratore_id = auth.uid()));


--
-- Name: consuntivo_template ct_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ct_update ON public.consuntivo_template FOR UPDATE USING ((amministratore_id = auth.uid())) WITH CHECK ((amministratore_id = auth.uid()));


--
-- Name: documenti_condominio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documenti_condominio ENABLE ROW LEVEL SECURITY;

--
-- Name: esercizi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.esercizi ENABLE ROW LEVEL SECURITY;

--
-- Name: esercizi esercizi own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "esercizi own" ON public.esercizi TO authenticated USING (public.user_owns_condominio(condominio_id)) WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: estratto_conto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estratto_conto ENABLE ROW LEVEL SECURITY;

--
-- Name: fatture_fornitori; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fatture_fornitori ENABLE ROW LEVEL SECURITY;

--
-- Name: fornitori; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fornitori ENABLE ROW LEVEL SECURITY;

--
-- Name: gemini_rate_limit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gemini_rate_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_documenti; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbox_documenti ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals insert_referral_client; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_referral_client ON public.referrals FOR INSERT TO authenticated WITH CHECK ((referred_id = auth.uid()));


--
-- Name: millesimi_unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.millesimi_unita ENABLE ROW LEVEL SECURITY;

--
-- Name: occupanti_unita occupanti_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occupanti_delete ON public.occupanti_unita FOR DELETE USING ((unita_id IN ( SELECT u.id
   FROM public.unita u
  WHERE public.user_owns_condominio(u.condominio_id))));


--
-- Name: occupanti_unita occupanti_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occupanti_insert ON public.occupanti_unita FOR INSERT WITH CHECK ((unita_id IN ( SELECT u.id
   FROM public.unita u
  WHERE public.user_owns_condominio(u.condominio_id))));


--
-- Name: occupanti_unita occupanti_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occupanti_select ON public.occupanti_unita FOR SELECT USING ((unita_id IN ( SELECT u.id
   FROM public.unita u
  WHERE public.user_owns_condominio(u.condominio_id))));


--
-- Name: occupanti_unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occupanti_unita ENABLE ROW LEVEL SECURITY;

--
-- Name: occupanti_unita occupanti_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occupanti_update ON public.occupanti_unita FOR UPDATE USING ((unita_id IN ( SELECT u.id
   FROM public.unita u
  WHERE public.user_owns_condominio(u.condominio_id)))) WITH CHECK ((unita_id IN ( SELECT u.id
   FROM public.unita u
  WHERE public.user_owns_condominio(u.condominio_id))));


--
-- Name: persone; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.persone ENABLE ROW LEVEL SECURITY;

--
-- Name: persone persone_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY persone_delete ON public.persone FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: persone persone_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY persone_insert ON public.persone FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: persone persone_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY persone_select ON public.persone FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: persone persone_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY persone_update ON public.persone FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: preventivi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preventivi ENABLE ROW LEVEL SECURITY;

--
-- Name: preventivi preventivi own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "preventivi own" ON public.preventivi TO authenticated USING ((condominio_id IN ( SELECT condomini.id
   FROM public.condomini
  WHERE (condomini.amministratore_id = auth.uid())))) WITH CHECK ((condominio_id IN ( SELECT condomini.id
   FROM public.condomini
  WHERE (condomini.amministratore_id = auth.uid()))));


--
-- Name: preventivo_voci; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preventivo_voci ENABLE ROW LEVEL SECURITY;

--
-- Name: preventivo_voci preventivo_voci own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "preventivo_voci own" ON public.preventivo_voci TO authenticated USING ((preventivo_id IN ( SELECT p.id
   FROM (public.preventivi p
     JOIN public.condomini c ON ((c.id = p.condominio_id)))
  WHERE (c.amministratore_id = auth.uid())))) WITH CHECK ((preventivo_id IN ( SELECT p.id
   FROM (public.preventivi p
     JOIN public.condomini c ON ((c.id = p.condominio_id)))
  WHERE (c.amministratore_id = auth.uid()))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_unita ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_unita rate_unita own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rate_unita own" ON public.rate_unita TO authenticated USING ((condominio_id IN ( SELECT condomini.id
   FROM public.condomini
  WHERE (condomini.amministratore_id = auth.uid())))) WITH CHECK ((condominio_id IN ( SELECT condomini.id
   FROM public.condomini
  WHERE (condomini.amministratore_id = auth.uid()))));


--
-- Name: referral_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: riconciliazioni_incassi ric_incassi own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ric_incassi own" ON public.riconciliazioni_incassi USING (public.user_owns_condominio(condominio_id)) WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: riconciliazioni; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.riconciliazioni ENABLE ROW LEVEL SECURITY;

--
-- Name: riconciliazioni_incassi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.riconciliazioni_incassi ENABLE ROW LEVEL SECURITY;

--
-- Name: ripartizioni; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ripartizioni ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log rls_audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_audit_insert ON public.audit_log FOR INSERT WITH CHECK (false);


--
-- Name: audit_log rls_audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_audit_select ON public.audit_log FOR SELECT USING (((condominio_id IS NULL) OR public.user_owns_condominio(condominio_id) OR (user_id = auth.uid())));


--
-- Name: millesimi_unita rls_millunita_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_millunita_delete ON public.millesimi_unita FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tabelle_millesimali t
  WHERE ((t.id = millesimi_unita.tabella_id) AND public.user_owns_condominio(t.condominio_id)))));


--
-- Name: millesimi_unita rls_millunita_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_millunita_insert ON public.millesimi_unita FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tabelle_millesimali t
  WHERE ((t.id = millesimi_unita.tabella_id) AND public.user_owns_condominio(t.condominio_id)))));


--
-- Name: millesimi_unita rls_millunita_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_millunita_select ON public.millesimi_unita FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tabelle_millesimali t
  WHERE ((t.id = millesimi_unita.tabella_id) AND public.user_owns_condominio(t.condominio_id)))));


--
-- Name: millesimi_unita rls_millunita_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_millunita_update ON public.millesimi_unita FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tabelle_millesimali t
  WHERE ((t.id = millesimi_unita.tabella_id) AND public.user_owns_condominio(t.condominio_id)))));


--
-- Name: config_pagante_unita rls_pagante_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_pagante_delete ON public.config_pagante_unita FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = config_pagante_unita.unita_id) AND public.user_owns_condominio(u.condominio_id)))));


--
-- Name: config_pagante_unita rls_pagante_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_pagante_insert ON public.config_pagante_unita FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = config_pagante_unita.unita_id) AND public.user_owns_condominio(u.condominio_id)))));


--
-- Name: config_pagante_unita rls_pagante_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_pagante_select ON public.config_pagante_unita FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = config_pagante_unita.unita_id) AND public.user_owns_condominio(u.condominio_id)))));


--
-- Name: config_pagante_unita rls_pagante_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_pagante_update ON public.config_pagante_unita FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.unita u
  WHERE ((u.id = config_pagante_unita.unita_id) AND public.user_owns_condominio(u.condominio_id)))));


--
-- Name: rate rls_rate_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_rate_delete ON public.rate FOR DELETE USING (public.user_owns_condominio(condominio_id));


--
-- Name: rate rls_rate_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_rate_insert ON public.rate FOR INSERT WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: rate rls_rate_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_rate_select ON public.rate FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: rate rls_rate_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_rate_update ON public.rate FOR UPDATE USING (public.user_owns_condominio(condominio_id));


--
-- Name: ripartizioni rls_ripart_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ripart_delete ON public.ripartizioni FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.spese s
  WHERE ((s.id = ripartizioni.spesa_id) AND public.user_owns_condominio(s.condominio_id)))));


--
-- Name: ripartizioni rls_ripart_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ripart_insert ON public.ripartizioni FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.spese s
  WHERE ((s.id = ripartizioni.spesa_id) AND public.user_owns_condominio(s.condominio_id)))));


--
-- Name: ripartizioni rls_ripart_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ripart_select ON public.ripartizioni FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.spese s
  WHERE ((s.id = ripartizioni.spesa_id) AND public.user_owns_condominio(s.condominio_id)))));


--
-- Name: ripartizioni rls_ripart_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ripart_update ON public.ripartizioni FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.spese s
  WHERE ((s.id = ripartizioni.spesa_id) AND public.user_owns_condominio(s.condominio_id)))));


--
-- Name: spese rls_spese_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_spese_delete ON public.spese FOR DELETE USING (public.user_owns_condominio(condominio_id));


--
-- Name: spese rls_spese_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_spese_insert ON public.spese FOR INSERT WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: spese rls_spese_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_spese_select ON public.spese FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: spese rls_spese_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_spese_update ON public.spese FOR UPDATE USING (public.user_owns_condominio(condominio_id));


--
-- Name: tabelle_millesimali rls_tabmill_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_tabmill_delete ON public.tabelle_millesimali FOR DELETE USING (public.user_owns_condominio(condominio_id));


--
-- Name: tabelle_millesimali rls_tabmill_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_tabmill_insert ON public.tabelle_millesimali FOR INSERT WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: tabelle_millesimali rls_tabmill_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_tabmill_select ON public.tabelle_millesimali FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: tabelle_millesimali rls_tabmill_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_tabmill_update ON public.tabelle_millesimali FOR UPDATE USING (public.user_owns_condominio(condominio_id));


--
-- Name: documenti_condominio s7 doccond delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "s7 doccond delete" ON public.documenti_condominio FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE ((c.id = documenti_condominio.condominio_id) AND (c.amministratore_id = auth.uid())))));


--
-- Name: documenti_condominio s7 doccond insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "s7 doccond insert" ON public.documenti_condominio FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE ((c.id = documenti_condominio.condominio_id) AND (c.amministratore_id = auth.uid())))));


--
-- Name: documenti_condominio s7 doccond select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "s7 doccond select" ON public.documenti_condominio FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE ((c.id = documenti_condominio.condominio_id) AND (c.amministratore_id = auth.uid())))));


--
-- Name: documenti_condominio s7 doccond update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "s7 doccond update" ON public.documenti_condominio FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE ((c.id = documenti_condominio.condominio_id) AND (c.amministratore_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE ((c.id = documenti_condominio.condominio_id) AND (c.amministratore_id = auth.uid())))));


--
-- Name: fatture_fornitori s7 fatt own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "s7 fatt own" ON public.fatture_fornitori TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: saldi_iniziali_unita saldi own delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "saldi own delete" ON public.saldi_iniziali_unita FOR DELETE USING (public.user_owns_condominio(condominio_id));


--
-- Name: saldi_iniziali_unita saldi own insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "saldi own insert" ON public.saldi_iniziali_unita FOR INSERT WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: saldi_iniziali_unita saldi own select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "saldi own select" ON public.saldi_iniziali_unita FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: saldi_iniziali_unita saldi own update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "saldi own update" ON public.saldi_iniziali_unita FOR UPDATE USING (public.user_owns_condominio(condominio_id)) WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: saldi_iniziali_unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saldi_iniziali_unita ENABLE ROW LEVEL SECURITY;

--
-- Name: segnalazioni_condominio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.segnalazioni_condominio ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_campaigns select_campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_campaigns ON public.referral_campaigns FOR SELECT TO authenticated USING (true);


--
-- Name: referrals select_my_referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_my_referrals ON public.referrals FOR SELECT TO authenticated USING (((referrer_id = auth.uid()) OR public.is_superadmin(auth.uid())));


--
-- Name: spese; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spese ENABLE ROW LEVEL SECURITY;

--
-- Name: subentri_contabilizzazione; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subentri_contabilizzazione ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_campaigns superadmin_manage_campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_manage_campaigns ON public.referral_campaigns TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));


--
-- Name: referrals superadmin_manage_referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_manage_referrals ON public.referrals TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));


--
-- Name: tickets_assistenza superadmin_update_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_update_tickets ON public.tickets_assistenza FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid()));


--
-- Name: profiles superadmin_view_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_view_profiles ON public.profiles FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));


--
-- Name: tabelle_millesimali; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tabelle_millesimali ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets_assistenza; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets_assistenza ENABLE ROW LEVEL SECURITY;

--
-- Name: unita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unita ENABLE ROW LEVEL SECURITY;

--
-- Name: unita unita_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unita_delete ON public.unita FOR DELETE USING (public.user_owns_condominio(condominio_id));


--
-- Name: unita unita_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unita_insert ON public.unita FOR INSERT WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: unita unita_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unita_select ON public.unita FOR SELECT USING (public.user_owns_condominio(condominio_id));


--
-- Name: unita unita_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unita_update ON public.unita FOR UPDATE USING (public.user_owns_condominio(condominio_id)) WITH CHECK (public.user_owns_condominio(condominio_id));


--
-- Name: comunicazioni user_insert_comunicazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_insert_comunicazioni ON public.comunicazioni FOR INSERT TO authenticated WITH CHECK (((amministratore_id = auth.uid()) AND ((condominio_id IS NULL) OR public.user_owns_condominio(condominio_id))));


--
-- Name: tickets_assistenza user_insert_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_insert_tickets ON public.tickets_assistenza FOR INSERT TO authenticated WITH CHECK ((utente_id = auth.uid()));


--
-- Name: comunicazioni user_select_comunicazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_select_comunicazioni ON public.comunicazioni FOR SELECT TO authenticated USING (((amministratore_id = auth.uid()) OR ((condominio_id IS NOT NULL) AND public.user_owns_condominio(condominio_id))));


--
-- Name: tickets_assistenza user_select_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_select_tickets ON public.tickets_assistenza FOR SELECT TO authenticated USING (((utente_id = auth.uid()) OR public.is_superadmin(auth.uid())));


--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: comunicazioni user_update_delete_comunicazioni; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_update_delete_comunicazioni ON public.comunicazioni TO authenticated USING ((amministratore_id = auth.uid()));


--
-- PostgreSQL database dump complete
--

\unrestrict 9hAs6IqZpFSfNpY6MMljkk8QM2TqAOXdKjWYKJZdtnNkaJzzc1Jren4cIBukymq

