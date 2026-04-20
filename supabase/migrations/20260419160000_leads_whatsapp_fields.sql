-- Campos extraídos por el agente IA de WhatsApp (n8n WHATSAPP HESSEN y similares).
-- Se añaden como text nullable para aceptar cualquier valor producido por el AI sin
-- forzar enums, evitando fallos de ingesta si el modelo devuelve valores nuevos.

alter table public.leads
  add column if not exists uso_principal text,
  add column if not exists pasajeros_filas text,
  add column if not exists transmision text,
  add column if not exists pie_disponible text,
  add column if not exists marca_preferida text,
  add column if not exists anos_minimo text,
  add column if not exists preferencia text,
  add column if not exists alerta_crediticia text,
  add column if not exists vehicle_interest text,
  add column if not exists raw_message text;

comment on column public.leads.uso_principal      is 'Uso principal declarado por el cliente (ej. Trabajo, Familia).';
comment on column public.leads.pasajeros_filas    is 'Cantidad de pasajeros / filas de asientos requeridas.';
comment on column public.leads.transmision        is 'Transmisión preferida (Automática, Manual, Indistinta).';
comment on column public.leads.pie_disponible     is 'Pie disponible para financiamiento (texto o monto como string).';
comment on column public.leads.marca_preferida    is 'Marca de vehículo preferida declarada por el cliente.';
comment on column public.leads.anos_minimo        is 'Año mínimo aceptable del vehículo (texto libre).';
comment on column public.leads.preferencia        is 'Preferencia adicional del cliente (texto libre).';
comment on column public.leads.alerta_crediticia  is 'Flag / descripción de alerta crediticia si corresponde.';
comment on column public.leads.vehicle_interest   is 'Tipo de vehículo de interés (texto libre, ej. SUV, sedán).';
comment on column public.leads.raw_message        is 'Mensaje estructurado original que produjo el AI al calificar el lead.';
