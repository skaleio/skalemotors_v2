-- Permitir notas de lead solo con imagen (sin texto).
--
-- Antes: lead_notes_body_check exigía body no vacío, pero la feature de adjuntos
-- (PR #99) permite notas solo con imagen. Resultado: el INSERT fallaba con
-- "violates check constraint lead_notes_body_check", el archivo subido se borraba
-- como huérfano y la imagen nunca quedaba guardada.
--
-- Ahora: una nota es válida si tiene texto O al menos un adjunto.

ALTER TABLE public.lead_notes DROP CONSTRAINT IF EXISTS lead_notes_body_check;

ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_body_check
  CHECK (
    char_length(trim(both from body)) > 0
    OR jsonb_array_length(attachments) > 0
  );
