-- 1. Aggiungiamo il Codice App ai condomini (codice PIN univoco)
ALTER TABLE condomini ADD COLUMN IF NOT EXISTS codice_app VARCHAR(6) UNIQUE;

-- Generiamo un codice random esadecimale (o alfanumerico) per i condomini esistenti che non ce l'hanno
UPDATE condomini 
SET codice_app = UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 6)) 
WHERE codice_app IS NULL;

-- 2. Funzione di Auto-Matching per l'App Condòmini
-- Questa funzione viene chiamata dal frontend dell'App Condòmini subito dopo la registrazione (o login).
-- Restituisce TRUE se il matching è avvenuto con successo, FALSE altrimenti.
CREATE OR REPLACE FUNCTION match_condomino_cf(p_codice_fiscale text, p_codice_app text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Permette di eseguire la funzione con i privilegi del creatore per poter leggere tutte le persone
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
