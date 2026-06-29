-- Adjuntos de imágenes en notas de seguimiento (lead_notes).
--   lead_notes.attachments        → jsonb[] con metadata de cada imagen
--   lead_notes_archive.attachments→ misma metadata, para auditoría append-only
--   bucket privado lead-note-attachments → archivos reales, RLS por tenant + acceso al lead
--
-- Cada item de attachments: { path, name, size, mime, width?, height? }
-- Path en storage: {tenant_id}/{lead_id}/{note_id}/{timestamp}-{rand}.{ext}

-- =====================================================================
-- 1. Columnas
-- =====================================================================
ALTER TABLE public.lead_notes
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lead_notes_archive
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lead_notes.attachments IS
  'Imágenes adjuntas a la nota: [{ path, name, size, mime, width?, height? }]. Archivos en bucket lead-note-attachments.';

-- =====================================================================
-- 2. Trigger de archivado: incluir attachments en cada snapshot
-- =====================================================================
CREATE OR REPLACE FUNCTION public.archive_lead_note_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, attachments, archive_action, archived_by
    ) VALUES (
      NEW.id, NEW.lead_id, NEW.tenant_id, NEW.branch_id, NEW.body, NEW.created_by,
      NEW.created_at, NEW.updated_at, NEW.source, NEW.attachments, 'insert', auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, attachments, archive_action, archived_by
    ) VALUES (
      OLD.id, OLD.lead_id, OLD.tenant_id, OLD.branch_id, OLD.body, OLD.created_by,
      OLD.created_at, OLD.updated_at, OLD.source, OLD.attachments, 'update', auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, attachments, archive_action, archived_by
    ) VALUES (
      OLD.id, OLD.lead_id, OLD.tenant_id, OLD.branch_id, OLD.body, OLD.created_by,
      OLD.created_at, OLD.updated_at, OLD.source, OLD.attachments, 'delete', auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================================
-- 3. Bucket privado para los archivos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-note-attachments',
  'lead-note-attachments',
  false, -- privado: se sirve con signed URLs (datos sensibles del cliente)
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- 4. Políticas en storage.objects (mismos permisos que lead_notes:
--    tenant del usuario + acceso al lead). Path: {tenant_id}/{lead_id}/{note_id}/...
-- =====================================================================
drop policy if exists lead_note_attachments_select on storage.objects;
create policy lead_note_attachments_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'lead-note-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.current_user_can_access_lead(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists lead_note_attachments_insert on storage.objects;
create policy lead_note_attachments_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'lead-note-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.current_user_can_access_lead(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists lead_note_attachments_update on storage.objects;
create policy lead_note_attachments_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'lead-note-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.current_user_can_access_lead(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'lead-note-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.current_user_can_access_lead(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists lead_note_attachments_delete on storage.objects;
create policy lead_note_attachments_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'lead-note-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.current_user_can_access_lead(((storage.foldername(name))[2])::uuid)
  );
