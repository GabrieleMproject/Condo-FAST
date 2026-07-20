-- sql/s57_bucket_security.sql
-- FIX H3: Configura le policy di sicurezza sui bucket Supabase Storage
-- Limita i tipi MIME accettati e la dimensione massima dei file

-- NOTA: Queste istruzioni vanno eseguite dalla Dashboard Supabase > Storage > Policies
-- oppure tramite la Supabase Management API, poiché non sono SQL standard.
-- Le riportiamo qui come documentazione e checklist.

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ BUCKET: documenti-condominio                                       │
-- │ Tipi: PDF, DOCX, XLSX, XLS, CSV, TXT, JPG, JPEG, PNG, WEBP       │
-- │ Limite: 10 MB                                                      │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ BUCKET: fatture                                                    │
-- │ Tipi: PDF, JPG, JPEG, PNG, WEBP, DOCX                            │
-- │ Limite: 10 MB                                                      │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ BUCKET: inbox-ricezione                                            │
-- │ Tipi: PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, XLS, CSV, TXT       │
-- │ Limite: 10 MB                                                      │
-- └─────────────────────────────────────────────────────────────────────┘

-- Aggiornamento bucket con allowed_mime_types e file_size_limit
-- (Richiede service_role o accesso dalla Dashboard Supabase)

UPDATE storage.buckets SET 
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv',
    'text/plain'
  ]
WHERE id = 'documenti-condominio';

UPDATE storage.buckets SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
WHERE id = 'fatture';

UPDATE storage.buckets SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain'
  ]
WHERE id = 'inbox-ricezione';
