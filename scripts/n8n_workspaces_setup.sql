-- =====================================================
-- Tabla de configuración n8n para multi-tenancy
-- =====================================================

-- Crear tabla n8n_workspaces
CREATE TABLE IF NOT EXISTS n8n_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL, -- ID del workspace en n8n
  api_key TEXT NOT NULL, -- API key del workspace
  webhook_url TEXT, -- URL base de webhooks
  whatsapp_phone TEXT, -- Número de WhatsApp Business
  instagram_account TEXT, -- Cuenta de Instagram
  ai_agent_config JSONB DEFAULT '{}', -- Configuración del agente IA
  automation_rules JSONB DEFAULT '[]', -- Reglas de automatización
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_n8n_workspaces_branch_id ON n8n_workspaces(branch_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workspaces_workspace_id ON n8n_workspaces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workspaces_is_active ON n8n_workspaces(is_active);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_n8n_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_n8n_workspaces_updated_at
  BEFORE UPDATE ON n8n_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_n8n_workspaces_updated_at();

-- Row Level Security (RLS)
ALTER TABLE n8n_workspaces ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver la configuración de su sucursal
CREATE POLICY "Users can view their branch n8n config"
  ON n8n_workspaces
  FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE id = auth.uid()
    )
  );

-- Política: Solo admins y gerentes pueden actualizar la configuración
CREATE POLICY "Admins and managers can update n8n config"
  ON n8n_workspaces
  FOR UPDATE
  USING (
    branch_id IN (
      SELECT branch_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

-- Política: Solo admins pueden insertar configuraciones
CREATE POLICY "Only admins can insert n8n config"
  ON n8n_workspaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política: Solo admins pueden eliminar configuraciones
CREATE POLICY "Only admins can delete n8n config"
  ON n8n_workspaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- =====================================================
-- Tabla de logs de ejecución de workflows n8n
-- =====================================================

CREATE TABLE IF NOT EXISTS n8n_workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES n8n_workspaces(id) NOT NULL,
  workflow_name TEXT NOT NULL,
  execution_id TEXT NOT NULL, -- ID de ejecución en n8n
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running', 'waiting')),
  trigger_type TEXT, -- webhook, schedule, manual, etc.
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_n8n_executions_workspace_id ON n8n_workflow_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_status ON n8n_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_started_at ON n8n_workflow_executions(started_at DESC);

-- RLS para logs
ALTER TABLE n8n_workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their branch workflow executions"
  ON n8n_workflow_executions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT nw.id FROM n8n_workspaces nw
      INNER JOIN users u ON nw.branch_id = u.branch_id
      WHERE u.id = auth.uid()
    )
  );

-- =====================================================
-- Comentarios de documentación
-- =====================================================

COMMENT ON TABLE n8n_workspaces IS 'Configuración de workspaces n8n por sucursal para automatizaciones multi-tenant';
COMMENT ON COLUMN n8n_workspaces.workspace_id IS 'ID único del workspace en la instancia n8n';
COMMENT ON COLUMN n8n_workspaces.api_key IS 'API key encriptada para autenticación con n8n';
COMMENT ON COLUMN n8n_workspaces.ai_agent_config IS 'Configuración JSON del agente IA (personalidad, prompts, horarios)';
COMMENT ON COLUMN n8n_workspaces.automation_rules IS 'Array JSON de reglas de automatización personalizadas';

COMMENT ON TABLE n8n_workflow_executions IS 'Registro de ejecuciones de workflows n8n para auditoría y debugging';
