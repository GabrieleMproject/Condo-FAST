-- Aggiunge la colonna data_documento per memorizzare la data ufficiale del documento (es. data assemblea per i verbali)
ALTER TABLE public.documenti_condominio ADD COLUMN data_documento DATE;
