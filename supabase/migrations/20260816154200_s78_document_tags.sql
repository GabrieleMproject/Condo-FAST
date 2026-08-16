-- sql/s78_document_tags.sql
-- Aggiunge la colonna tags alla tabella documenti_condominio per il tagging automatizzato

ALTER TABLE public.documenti_condominio 
ADD COLUMN tags text[] DEFAULT '{}';

-- Creazione dell'indice GIN per ottimizzare la ricerca negli array di stringhe
CREATE INDEX idx_documenti_condominio_tags ON public.documenti_condominio USING GIN (tags);

-- Aggiorniamo la vista o i permessi se necessario (in CondoFAST, le RLS sono sulla tabella direttamente)
