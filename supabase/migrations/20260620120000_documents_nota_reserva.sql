-- Nota de reserva: nuevo tipo de documento + fecha de vencimiento de la reserva.
-- El monto reservado se guarda en documents.down_payment (fijo $200.000 por código).

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('contrato_venta', 'contrato_consignacion', 'nota_reserva'));

ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS document_templates_type_check;
ALTER TABLE document_templates ADD CONSTRAINT document_templates_type_check
  CHECK (type IN ('contrato_venta', 'contrato_consignacion', 'nota_reserva'));

ALTER TABLE documents ADD COLUMN IF NOT EXISTS reservation_expires_at DATE;
