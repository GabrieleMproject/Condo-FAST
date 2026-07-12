-- sql/s36_assistenza_knowledge.sql

-- Creazione tabella per la knowledge base dell'assistenza
CREATE TABLE IF NOT EXISTS public.assistenza_knowledge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    argomento text NOT NULL,
    domanda_sintesi text NOT NULL,
    risoluzione text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.assistenza_knowledge ENABLE ROW LEVEL SECURITY;

-- Chiunque sia autenticato (amministratori di condominio) può leggere la knowledge base per far consultare l'AI
CREATE POLICY authenticated_select_knowledge ON public.assistenza_knowledge
    FOR SELECT TO authenticated
    USING (true);

-- Solo i SuperAdmin possono inserire, aggiornare o eliminare record nella knowledge base
CREATE POLICY superadmin_all_knowledge ON public.assistenza_knowledge
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

-- Creiamo un indice full-text search per velocizzare le query di ricerca da parte del chatbot
CREATE INDEX IF NOT EXISTS idx_knowledge_fts ON public.assistenza_knowledge 
USING gin(to_tsvector('italian', COALESCE(domanda_sintesi, '') || ' ' || COALESCE(risoluzione, '')));

NOTIFY pgrst, 'reload schema';
