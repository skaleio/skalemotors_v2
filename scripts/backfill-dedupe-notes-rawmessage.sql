-- One-shot: limpia leads.notes cuando duplica el contenido de leads.raw_message.
-- Seguro ejecutar varias veces: solo afecta filas donde ambos coinciden.
-- Ejecutar en Supabase Studio → SQL Editor del proyecto SKALEMOTORS.

-- 1) Caso exacto: notes == raw_message → notes a NULL.
update public.leads
set notes = null,
    updated_at = now()
where raw_message is not null
  and notes is not null
  and btrim(notes) = btrim(raw_message);

-- 2) Caso donde notes CONTIENE el raw_message (p.ej. también tiene un prefijo
--    "Vehículo de interés: …" concatenado por buildNotes): quitamos el bloque
--    y dejamos lo demás; si queda vacío, NULL.
update public.leads
set notes = nullif(
      btrim(replace(notes, raw_message, '')),
      ''
    ),
    updated_at = now()
where raw_message is not null
  and notes is not null
  and position(btrim(raw_message) in notes) > 0
  and btrim(notes) <> btrim(raw_message);  -- ya cubierto por el paso 1

-- Verificación posterior (opcional):
-- select id, full_name, notes, raw_message
-- from public.leads
-- where notes is not null and raw_message is not null
-- order by updated_at desc limit 20;
