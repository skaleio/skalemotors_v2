import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";

// =====================================================
// Tipos
// =====================================================

export interface N8nWorkspaceConfig {
  id: string;
  branch_id: string;
  workspace_id: string;
  api_key: string;
  webhook_url: string | null;
  whatsapp_phone: string | null;
  instagram_account: string | null;
  ai_agent_config: AIAgentConfig;
  automation_rules: AutomationRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIAgentConfig {
  name?: string;
  personality?: 'formal' | 'casual' | 'tecnico';
  language?: 'es-CL' | 'es-MX' | 'es-ES' | 'es-AR';
  auto_response_enabled?: boolean;
  response_hours?: {
    start: string; // HH:mm format
    end: string;
  };
  knowledge_base?: {
    faqs: Array<{ question: string; answer: string }>;
    vehicle_catalog_enabled: boolean;
    price_ranges_enabled: boolean;
  };
  auto_response_rules?: Array<{
    trigger: string; // regex o keyword
    response_template: string;
    requires_human: boolean;
  }>;
  escalation_rules?: {
    keywords: string[]; // "gerente", "queja", "cancelar"
    inactive_hours: number;
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'new_message' | 'lead_inactive' | 'schedule' | 'manual';
    conditions?: Record<string, any>;
  };
  actions: Array<{
    type: 'move_lead_stage' | 'assign_user' | 'send_message' | 'create_task';
    params: Record<string, any>;
  }>;
}

export interface WorkflowExecution {
  id: string;
  workspace_id: string;
  workflow_name: string;
  execution_id: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  trigger_type?: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  execution_time_ms?: number;
  started_at: string;
  finished_at?: string;
}

// =====================================================
// Servicio N8n
// =====================================================

export class N8nService {
  private static N8N_BASE_URL = import.meta.env.VITE_N8N_URL || 'http://localhost:5678';
  private static N8N_API_KEY = import.meta.env.VITE_N8N_API_KEY;

  // =====================================================
  // Gestión de Workspaces
  // =====================================================

  /**
   * Crear workspace para nuevo cliente/sucursal
   */
  static async createWorkspace(branchId: string, branchName: string): Promise<N8nWorkspaceConfig> {
    try {
      // 1. Verificar que la sucursal existe
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('id', branchId)
        .single();

      if (branchError || !branch) {
        throw new Error('Sucursal no encontrada');
      }

      // 2. Verificar que no existe ya un workspace para esta sucursal
      const { data: existing } = await supabase
        .from('n8n_workspaces')
        .select('id')
        .eq('branch_id', branchId)
        .single();

      if (existing) {
        throw new Error('Ya existe un workspace para esta sucursal');
      }

      // 3. Llamar API de n8n para crear workspace (si usas n8n Cloud)
      // Si usas self-hosted, el workspace_id puede ser simplemente el branch_id
      const workspaceId = await this.callN8nCreateWorkspace(branchName);

      // 4. Generar API key del workspace
      const apiKey = await this.generateWorkspaceApiKey(workspaceId);

      // 5. Guardar en Supabase
      const { data, error } = await supabase
        .from('n8n_workspaces')
        .insert({
          branch_id: branchId,
          workspace_id: workspaceId,
          api_key: apiKey,
          webhook_url: `${this.N8N_BASE_URL}/webhook/${workspaceId}`,
          ai_agent_config: this.getDefaultAIAgentConfig(),
          automation_rules: []
        })
        .select()
        .single();

      if (error) throw error;

      // 6. Desplegar workflows base
      await this.deployBaseWorkflows(workspaceId);

      return data as N8nWorkspaceConfig;
    } catch (error) {
      console.error('Error creating n8n workspace:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración de workspace por branch_id
   */
  static async getWorkspaceByBranch(branchId: string): Promise<N8nWorkspaceConfig | null> {
    try {
      const { data, error } = await supabase
        .from('n8n_workspaces')
        .select('*')
        .eq('branch_id', branchId)
        .single();

      if (error) {
        // PGRST116 = No rows found
        if (error.code === 'PGRST116') return null;
        
        // Si la tabla no existe, retornar null en lugar de error
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Tabla n8n_workspaces no existe. Ejecuta el script SQL de setup.');
          return null;
        }
        
        throw error;
      }

      return data as N8nWorkspaceConfig;
    } catch (error) {
      console.error('Error in getWorkspaceByBranch:', error);
      return null;
    }
  }

  /**
   * Actualizar configuración de workspace
   */
  static async updateWorkspace(
    workspaceId: string,
    updates: Partial<Omit<N8nWorkspaceConfig, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<N8nWorkspaceConfig> {
    const { data, error } = await supabase
      .from('n8n_workspaces')
      .update(updates)
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) throw error;
    return data as N8nWorkspaceConfig;
  }

  /**
   * Actualizar configuración del agente IA
   */
  static async updateAIAgentConfig(
    workspaceId: string,
    config: AIAgentConfig
  ): Promise<N8nWorkspaceConfig> {
    return this.updateWorkspace(workspaceId, { ai_agent_config: config });
  }

  /**
   * Actualizar reglas de automatización
   */
  static async updateAutomationRules(
    workspaceId: string,
    rules: AutomationRule[]
  ): Promise<N8nWorkspaceConfig> {
    return this.updateWorkspace(workspaceId, { automation_rules: rules });
  }

  // =====================================================
  // Gestión de Workflows
  // =====================================================

  /**
   * Desplegar workflows base para nuevo cliente
   */
  static async deployBaseWorkflows(workspaceId: string): Promise<void> {
    const baseWorkflows = [
      'whatsapp-to-crm',
      'instagram-to-crm',
      'lead-auto-assignment',
      'ai-agent-responder',
      'lead-stage-automation'
    ];

    for (const workflow of baseWorkflows) {
      try {
        await this.deployWorkflow(workspaceId, workflow);
      } catch (error) {
        console.error(`Error deploying workflow ${workflow}:`, error);
        // Continuar con los demás workflows
      }
    }
  }

  /**
   * Desplegar un workflow específico
   */
  static async deployWorkflow(workspaceId: string, workflowName: string): Promise<void> {
    try {
      // Aquí llamarías a la API de n8n para crear/activar el workflow
      const workflowTemplate = this.getWorkflowTemplate(workflowName);
      
      await this.callN8nAPI(`/workflows`, {
        method: 'POST',
        body: {
          name: `${workflowName}-${workspaceId}`,
          nodes: workflowTemplate.nodes,
          connections: workflowTemplate.connections,
          active: true,
          settings: {
            ...workflowTemplate.settings,
            workspaceId
          }
        }
      });
    } catch (error) {
      console.error(`Error deploying workflow ${workflowName}:`, error);
      throw error;
    }
  }

  /**
   * Ejecutar workflow manualmente
   */
  static async executeWorkflow(
    workspaceId: string,
    workflowName: string,
    inputData?: Record<string, any>
  ): Promise<WorkflowExecution> {
    try {
      const execution = await this.callN8nAPI(`/workflows/${workflowName}/execute`, {
        method: 'POST',
        body: { data: inputData }
      });

      // Registrar ejecución en Supabase
      const { data, error } = await supabase
        .from('n8n_workflow_executions')
        .insert({
          workspace_id: workspaceId,
          workflow_name: workflowName,
          execution_id: execution.id,
          status: 'running',
          trigger_type: 'manual',
          input_data: inputData,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data as WorkflowExecution;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    }
  }

  /**
   * Obtener logs de ejecuciones
   */
  static async getWorkflowExecutions(
    workspaceId: string,
    filters?: {
      workflow_name?: string;
      status?: string;
      limit?: number;
    }
  ): Promise<WorkflowExecution[]> {
    let query = supabase
      .from('n8n_workflow_executions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false });

    if (filters?.workflow_name) {
      query = query.eq('workflow_name', filters.workflow_name);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as WorkflowExecution[];
  }

  // =====================================================
  // Webhooks
  // =====================================================

  /**
   * Generar URL de webhook para un workflow específico
   */
  static getWebhookUrl(workspaceId: string, workflowName: string): string {
    return `${this.N8N_BASE_URL}/webhook/${workspaceId}/${workflowName}`;
  }

  /**
   * Validar firma de webhook (seguridad)
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Implementar validación HMAC SHA256
    // const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // return signature === expectedSignature;
    return true; // Placeholder
  }

  // =====================================================
  // Métodos Privados / Helpers
  // =====================================================

  /**
   * Llamar API de n8n
   */
  private static async callN8nAPI(endpoint: string, options: {
    method: string;
    body?: any;
    apiKey?: string;
  }): Promise<any> {
    const url = `${this.N8N_BASE_URL}/api/v1${endpoint}`;
    const apiKey = options.apiKey || this.N8N_API_KEY;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey || ''
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Crear workspace en n8n (Cloud o self-hosted)
   */
  private static async callN8nCreateWorkspace(name: string): Promise<string> {
    // Si usas n8n Cloud con API de workspaces
    // const result = await this.callN8nAPI('/workspaces', {
    //   method: 'POST',
    //   body: { name }
    // });
    // return result.id;

    // Si usas self-hosted, generar un ID único
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generar API key para workspace
   */
  private static async generateWorkspaceApiKey(workspaceId: string): Promise<string> {
    // Generar API key segura
    // En producción, usar crypto.randomBytes o similar
    return `n8n_${workspaceId}_${Math.random().toString(36).substr(2, 32)}`;
  }

  /**
   * Obtener configuración por defecto del agente IA
   */
  private static getDefaultAIAgentConfig(): AIAgentConfig {
    return {
      name: 'Asistente Virtual',
      personality: 'formal',
      language: 'es-CL',
      auto_response_enabled: true,
      response_hours: {
        start: '09:00',
        end: '18:00'
      },
      knowledge_base: {
        faqs: [],
        vehicle_catalog_enabled: true,
        price_ranges_enabled: false
      },
      auto_response_rules: [
        {
          trigger: 'hola|buenos días|buenas tardes',
          response_template: '¡Hola! Bienvenido a {{branch_name}}. ¿En qué puedo ayudarte hoy?',
          requires_human: false
        },
        {
          trigger: 'precio|cuánto cuesta|valor',
          response_template: 'Con gusto te puedo ayudar con información de precios. Un asesor se pondrá en contacto contigo pronto.',
          requires_human: true
        }
      ],
      escalation_rules: {
        keywords: ['gerente', 'queja', 'cancelar', 'mal servicio', 'problema'],
        inactive_hours: 24
      }
    };
  }

  /**
   * Obtener template de workflow
   */
  private static getWorkflowTemplate(workflowName: string): any {
    // Aquí retornarías los templates JSON de workflows n8n
    // Por ahora, retornamos un placeholder
    return {
      nodes: [],
      connections: {},
      settings: {}
    };
  }
}

// =====================================================
// Exportar tipos y servicio
// =====================================================

export default N8nService;
