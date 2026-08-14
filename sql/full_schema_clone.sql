--
-- PostgreSQL database dump
--

\restrict tVwFOx77BImjeIeFTafMVnhgUldkP6iPnKoWVtYQ55D6OeIRA93a3aFFgISi5Fy

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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
begin
    if not exists (
        select 1
        from pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


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


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    new.selected_columns = (
        select array_agg(c order by c)
        from unnest(new.selected_columns) c
    );

    return new;
end;
$$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


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
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_08_11; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_11 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_12; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_12 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_13; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_13 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_14; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_14 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_15; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_15 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_16; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_16 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_08_17; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_08_17 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: messages_2026_08_11; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_11 FOR VALUES FROM ('2026-08-11 00:00:00') TO ('2026-08-12 00:00:00');


--
-- Name: messages_2026_08_12; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_12 FOR VALUES FROM ('2026-08-12 00:00:00') TO ('2026-08-13 00:00:00');


--
-- Name: messages_2026_08_13; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_13 FOR VALUES FROM ('2026-08-13 00:00:00') TO ('2026-08-14 00:00:00');


--
-- Name: messages_2026_08_14; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_14 FOR VALUES FROM ('2026-08-14 00:00:00') TO ('2026-08-15 00:00:00');


--
-- Name: messages_2026_08_15; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_15 FOR VALUES FROM ('2026-08-15 00:00:00') TO ('2026-08-16 00:00:00');


--
-- Name: messages_2026_08_16; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_16 FOR VALUES FROM ('2026-08-16 00:00:00') TO ('2026-08-17 00:00:00');


--
-- Name: messages_2026_08_17; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_08_17 FOR VALUES FROM ('2026-08-17 00:00:00') TO ('2026-08-18 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


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
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_11 messages_2026_08_11_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_11
    ADD CONSTRAINT messages_2026_08_11_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_12 messages_2026_08_12_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_12
    ADD CONSTRAINT messages_2026_08_12_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_13 messages_2026_08_13_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_13
    ADD CONSTRAINT messages_2026_08_13_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_14 messages_2026_08_14_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_14
    ADD CONSTRAINT messages_2026_08_14_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_15 messages_2026_08_15_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_15
    ADD CONSTRAINT messages_2026_08_15_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_16 messages_2026_08_16_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_16
    ADD CONSTRAINT messages_2026_08_16_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_08_17 messages_2026_08_17_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_08_17
    ADD CONSTRAINT messages_2026_08_17_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


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
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_11_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_11_inserted_at_topic_idx ON realtime.messages_2026_08_11 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_12_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_12_inserted_at_topic_idx ON realtime.messages_2026_08_12 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_13_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_13_inserted_at_topic_idx ON realtime.messages_2026_08_13 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_14_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_14_inserted_at_topic_idx ON realtime.messages_2026_08_14 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_15_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_15_inserted_at_topic_idx ON realtime.messages_2026_08_15 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_16_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_16_inserted_at_topic_idx ON realtime.messages_2026_08_16 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_08_17_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_08_17_inserted_at_topic_idx ON realtime.messages_2026_08_17 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2026_08_11_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_11_inserted_at_topic_idx;


--
-- Name: messages_2026_08_11_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_11_pkey;


--
-- Name: messages_2026_08_12_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_12_inserted_at_topic_idx;


--
-- Name: messages_2026_08_12_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_12_pkey;


--
-- Name: messages_2026_08_13_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_13_inserted_at_topic_idx;


--
-- Name: messages_2026_08_13_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_13_pkey;


--
-- Name: messages_2026_08_14_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_14_inserted_at_topic_idx;


--
-- Name: messages_2026_08_14_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_14_pkey;


--
-- Name: messages_2026_08_15_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_15_inserted_at_topic_idx;


--
-- Name: messages_2026_08_15_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_15_pkey;


--
-- Name: messages_2026_08_16_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_16_inserted_at_topic_idx;


--
-- Name: messages_2026_08_16_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_16_pkey;


--
-- Name: messages_2026_08_17_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_08_17_inserted_at_topic_idx;


--
-- Name: messages_2026_08_17_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_08_17_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

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
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Gli utenti caricano i propri file in inbox-ricezione; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Gli utenti caricano i propri file in inbox-ricezione" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'inbox-ricezione'::text) AND (("substring"(name, '^([^/]+)/'::text) = (auth.uid())::text) OR ("substring"(name, '^([^/]+)/'::text) IN ( SELECT (cs.amministratore_id)::text AS amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true)))))));


--
-- Name: objects Gli utenti eliminano i propri file in inbox-ricezione; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Gli utenti eliminano i propri file in inbox-ricezione" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'inbox-ricezione'::text) AND (("substring"(name, '^([^/]+)/'::text) = (auth.uid())::text) OR ("substring"(name, '^([^/]+)/'::text) IN ( SELECT (cs.amministratore_id)::text AS amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true)))))));


--
-- Name: objects Gli utenti leggono i propri file in inbox-ricezione; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Gli utenti leggono i propri file in inbox-ricezione" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'inbox-ricezione'::text) AND ((owner = auth.uid()) OR ("substring"(name, '^([^/]+)/'::text) = (auth.uid())::text) OR ("substring"(name, '^([^/]+)/'::text) IN ( SELECT (cs.amministratore_id)::text AS amministratore_id
   FROM public.collaboratori_studio cs
  WHERE (((cs.utente_id = auth.uid()) OR (cs.email_collaboratore = auth.email())) AND (cs.attivo = true)))))));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects s7 doc delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 doc delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'documenti-condominio'::text) AND (EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND (c.amministratore_id = auth.uid()))))));


--
-- Name: objects s7 doc insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 doc insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'documenti-condominio'::text) AND (EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND (c.amministratore_id = auth.uid()))))));


--
-- Name: objects s7 doc select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 doc select" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'documenti-condominio'::text) AND (EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND (c.amministratore_id = auth.uid()))))));


--
-- Name: objects s7 doc update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 doc update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'documenti-condominio'::text) AND (EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND (c.amministratore_id = auth.uid())))))) WITH CHECK (((bucket_id = 'documenti-condominio'::text) AND (EXISTS ( SELECT 1
   FROM public.condomini c
  WHERE (((c.id)::text = (storage.foldername(objects.name))[1]) AND (c.amministratore_id = auth.uid()))))));


--
-- Name: objects s7 fatt delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 fatt delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'fatture'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects s7 fatt insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 fatt insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'fatture'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects s7 fatt select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 fatt select" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'fatture'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects s7 fatt update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "s7 fatt update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'fatture'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'fatture'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime assemblee_odg; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.assemblee_odg;


--
-- Name: supabase_realtime assemblee_presenze; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.assemblee_presenze;


--
-- Name: supabase_realtime assemblee_voti; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.assemblee_voti;


--
-- Name: supabase_realtime user_sessions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.user_sessions;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict tVwFOx77BImjeIeFTafMVnhgUldkP6iPnKoWVtYQ55D6OeIRA93a3aFFgISi5Fy

