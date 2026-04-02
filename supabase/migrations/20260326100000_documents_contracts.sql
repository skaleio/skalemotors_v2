-- Tabla de documentos / contratos
-- Fase 1 SkaléMotors: contratos de venta y consignación

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES branches(id),
  created_by      UUID REFERENCES users(id),
  type            TEXT NOT NULL CHECK (type IN ('contrato_venta', 'contrato_consignacion')),
  document_number TEXT,
  status          TEXT DEFAULT 'borrador'
                    CHECK (status IN ('borrador', 'generado', 'firmado', 'anulado')),

  -- Vehículo (campos desnormalizados para que el contrato sea inmutable)
  vehicle_id      UUID REFERENCES vehicles(id),
  vehicle_make    TEXT,
  vehicle_model   TEXT,
  vehicle_year    INT,
  vehicle_vin     TEXT,
  vehicle_patente TEXT,
  vehicle_km      INT,
  vehicle_color   TEXT,

  -- Comprador (contrato_venta)
  buyer_name      TEXT,
  buyer_rut       TEXT,
  buyer_phone     TEXT,
  buyer_email     TEXT,
  buyer_address   TEXT,

  -- Propietario (contrato_consignacion)
  owner_name      TEXT,
  owner_rut       TEXT,
  owner_phone     TEXT,
  owner_email     TEXT,
  owner_address   TEXT,

  -- Financiero
  sale_price            NUMERIC,
  commission_percentage NUMERIC,
  commission_amount     NUMERIC,
  payment_method        TEXT,

  -- Referencias a otras entidades
  sale_id         UUID REFERENCES sales(id),
  consignacion_id UUID REFERENCES consignaciones(id),
  lead_id         UUID REFERENCES leads(id),

  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Política SELECT: usuarios ven documentos de su sucursal
CREATE POLICY "documents_select_branch"
  ON documents FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE id = auth.uid()
    )
    OR branch_id IS NULL
  );

-- Política INSERT: cualquier usuario autenticado puede crear
CREATE POLICY "documents_insert_authenticated"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Política UPDATE: el creador o admin/gerente pueden editar
CREATE POLICY "documents_update_own"
  ON documents FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
    )
  );

-- Política DELETE: solo admin/gerente
CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'gerente', 'jefe_jefe')
    )
  );

-- Función y trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_branch_id  ON documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_documents_type       ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status     ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id    ON documents(lead_id);
