-- Aggiunta colonna per tracciare il verbale di approvazione assembleare
ALTER TABLE public.condominio_servizi_telematici 
ADD COLUMN IF NOT EXISTS verbale_approvazione_id UUID REFERENCES public.documenti_condominio(id) ON DELETE SET NULL;
