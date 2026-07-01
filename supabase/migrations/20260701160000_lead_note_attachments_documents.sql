-- Ampliar los adjuntos de notas de leads: además de imágenes, permitir documentos
-- (PDF, Word, Excel, CSV) para guardar la documentación que envía el cliente.
-- Solo cambia la config del bucket ya existente `lead-note-attachments`; las
-- políticas RLS (tenant + acceso al lead) creadas en 20260624120000 no cambian,
-- así que el vendedor con el lead delegado sigue pudiendo ver/descargar los archivos.

update storage.buckets
set
  file_size_limit = 20971520, -- 20 MB: los documentos no se comprimen
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
where id = 'lead-note-attachments';

comment on column public.lead_notes.attachments is
  'Adjuntos de la nota (imágenes o documentos): [{ path, name, size, mime, width?, height? }]. Archivos en bucket lead-note-attachments.';
