import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Bot, Sparkles, RefreshCw, CheckCircle2, Plus, Trash2, Settings, Zap, MessageSquare, Instagram, Phone, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import N8nService, { type AIAgentConfig, type AutomationRule } from "@/lib/services/n8n";
import AIAgentBuilder from "@/components/AIAgentBuilder";
import AutomationRulesBuilder from "@/components/AutomationRulesBuilder";

interface AgentData {
  name: string;
  purpose: string;
  tasks: string[];
  integration: string;
  behavior: string;
  responseStyle: string;
}

export default function ConstructorAgentes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceConfig, setWorkspaceConfig] = useState<any>(null);
  
  // Estados de configuración n8n
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [instagramAccount, setInstagramAccount] = useState('');
  const [aiAgentConfig, setAiAgentConfig] = useState<AIAgentConfig>({
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
    auto_response_rules: [],
    escalation_rules: {
      keywords: ['gerente', 'queja', 'cancelar'],
      inactive_hours: 24
    }
  });
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  
  // Estados del formulario original (agentes simples)
  const [formData, setFormData] = useState<AgentData>({
    name: "",
    purpose: "",
    tasks: [],
    integration: "none",
    behavior: "helpful",
    responseStyle: "professional"
  });
  const [newTask, setNewTask] = useState("");
  const [createdAgents, setCreatedAgents] = useState<string[]>([]);

  useEffect(() => {
    loadWorkspaceConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branch_id]);

  const loadWorkspaceConfig = async () => {
    try {
      setLoading(true);
      
      // Si no hay user o branch_id, simplemente terminamos la carga
      if (!user?.branch_id) {
        setLoading(false);
        return;
      }

      const config = await N8nService.getWorkspaceByBranch(user.branch_id);
      
      if (config) {
        setWorkspaceConfig(config);
        setWhatsappPhone(config.whatsapp_phone || '');
        setInstagramAccount(config.instagram_account || '');
        setAiAgentConfig(config.ai_agent_config || aiAgentConfig);
        setAutomationRules(config.automation_rules || []);
      }
    } catch (error) {
      console.error('Error loading workspace config:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!user?.branch_id) return;

    try {
      setSaving(true);
      const branchName = user.branch_id;
      const config = await N8nService.createWorkspace(user.branch_id, branchName);
      
      setWorkspaceConfig(config);
      toast.success('Workspace de automatización creado exitosamente');
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Error al crear workspace de automatización');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConnections = async () => {
    if (!workspaceConfig) return;

    try {
      setSaving(true);
      await N8nService.updateWorkspace(workspaceConfig.id, {
        whatsapp_phone: whatsappPhone,
        instagram_account: instagramAccount
      });
      
      toast.success('Conexiones guardadas exitosamente');
    } catch (error) {
      console.error('Error saving connections:', error);
      toast.error('Error al guardar conexiones');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAIAgent = async () => {
    if (!workspaceConfig) return;

    try {
      setSaving(true);
      await N8nService.updateAIAgentConfig(workspaceConfig.id, aiAgentConfig);
      
      toast.success('Configuración del agente IA guardada');
    } catch (error) {
      console.error('Error saving AI agent config:', error);
      toast.error('Error al guardar configuración del agente IA');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAutomationRules = async () => {
    if (!workspaceConfig) return;

    try {
      setSaving(true);
      await N8nService.updateAutomationRules(workspaceConfig.id, automationRules);
      
      toast.success('Reglas de automatización guardadas');
    } catch (error) {
      console.error('Error saving automation rules:', error);
      toast.error('Error al guardar reglas de automatización');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof AgentData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTask = () => {
    if (newTask.trim()) {
      handleInputChange('tasks', [...formData.tasks, newTask.trim()]);
      setNewTask("");
    }
  };

  const handleRemoveTask = (index: number) => {
    handleInputChange('tasks', formData.tasks.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.purpose.trim()) {
      toast.error("Por favor, completa el nombre y propósito del agente.");
      return;
    }

    if (formData.tasks.length === 0) {
      toast.error("Agrega al menos una tarea para el agente.");
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCreatedAgents(prev => [...prev, formData.name]);
      
      toast.success(`El agente "${formData.name}" ha sido creado exitosamente.`);

      // Reset form
      setFormData({
        name: "",
        purpose: "",
        tasks: [],
        integration: "none",
        behavior: "helpful",
        responseStyle: "professional"
      });
    } catch (error) {
      toast.error("No se pudo crear el agente. Por favor, intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si no hay workspace, mostrar pantalla de creación
  if (!workspaceConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            Constructor de Agentes IA
          </h1>
          <p className="text-muted-foreground mt-2">
            Crea agentes de IA personalizados y automatizaciones inteligentes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              Configuración de Automatizaciones
            </CardTitle>
            <CardDescription>
              No tienes un workspace de automatización configurado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    ¿Qué son las automatizaciones?
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Las automatizaciones te permiten conectar WhatsApp, Instagram y otros canales
                    con tu CRM, responder automáticamente con IA, y mover leads inteligentemente.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Funcionalidades incluidas:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Integración con WhatsApp Business API</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Agente IA con respuestas automáticas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Movimiento automático de leads en CRM</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Asignación inteligente de vendedores</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Integración con Instagram y Facebook</span>
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleCreateWorkspace} 
              disabled={saving}
              className="w-full"
              size="lg"
            >
              {saving ? 'Creando...' : 'Crear Workspace de Automatización'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          Constructor de Agentes IA
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea agentes de IA personalizados y automatizaciones inteligentes para tu automotora
        </p>
      </div>

      <Tabs defaultValue="ai-agent" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-agent" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agente IA
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automatizaciones
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conexiones
          </TabsTrigger>
          <TabsTrigger value="simple-agents" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Agentes Simples
          </TabsTrigger>
        </TabsList>

        {/* Tab: Agente IA con n8n */}
        <TabsContent value="ai-agent">
          <AIAgentBuilder
            config={aiAgentConfig}
            onChange={setAiAgentConfig}
            onSave={handleSaveAIAgent}
            saving={saving}
          />
        </TabsContent>

        {/* Tab: Automatizaciones */}
        <TabsContent value="automation">
          <AutomationRulesBuilder
            rules={automationRules}
            onChange={setAutomationRules}
            onSave={handleSaveAutomationRules}
            saving={saving}
          />
        </TabsContent>

        {/* Tab: Conexiones */}
        <TabsContent value="connections">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  WhatsApp Business
                </CardTitle>
                <CardDescription>
                  Conecta tu número de WhatsApp Business para recibir y enviar mensajes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-phone">Número de WhatsApp</Label>
                  <Input
                    id="whatsapp-phone"
                    placeholder="+56912345678"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Incluye el código de país (ej: +56 para Chile)
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Nota:</strong> Necesitas una cuenta de WhatsApp Business API.
                    Contacta a tu administrador para obtener las credenciales.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Instagram className="h-5 w-5" />
                  Instagram
                </CardTitle>
                <CardDescription>
                  Conecta tu cuenta de Instagram para recibir mensajes directos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram-account">Usuario de Instagram</Label>
                  <Input
                    id="instagram-account"
                    placeholder="@tuautomotora"
                    value={instagramAccount}
                    onChange={(e) => setInstagramAccount(e.target.value)}
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    La integración con Instagram requiere una cuenta de Facebook Business
                    y aprobación de Meta.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConnections} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Conexiones'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Agentes Simples (formulario original) */}
        <TabsContent value="simple-agents">

          <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-500" />
              Configuración del Agente
            </CardTitle>
            <CardDescription>
              Define las características y comportamiento de tu agente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre del Agente *</Label>
              <Input
                id="name"
                placeholder="Ej: Asistente de Ventas, Agente de Soporte"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="purpose">Propósito *</Label>
              <Textarea
                id="purpose"
                placeholder="Describe para qué se utilizará este agente. Ej: Responder consultas sobre vehículos disponibles, agendar test drives..."
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div>
              <Label>Tareas que Realizará *</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Ej: Responder preguntas sobre precios"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <Button type="button" onClick={handleAddTask} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tasks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {formData.tasks.map((task, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <span>{task}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTask(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="behavior">Comportamiento</Label>
                <Select value={formData.behavior} onValueChange={(value) => handleInputChange('behavior', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="helpful">Servicial</SelectItem>
                    <SelectItem value="professional">Profesional</SelectItem>
                    <SelectItem value="friendly">Amigable</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="responseStyle">Estilo de Respuesta</Label>
                <Select value={formData.responseStyle} onValueChange={(value) => handleInputChange('responseStyle', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Profesional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="technical">Técnico</SelectItem>
                    <SelectItem value="sales">Ventas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="integration">Integración</Label>
              <Select value={formData.integration} onValueChange={(value) => handleInputChange('integration', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin integración</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="inventory">Inventario</SelectItem>
                  <SelectItem value="calendar">Calendario</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreate} 
              disabled={saving || !formData.name.trim() || !formData.purpose.trim() || formData.tasks.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Crear Agente
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Agentes Creados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              Agentes Creados
            </CardTitle>
            <CardDescription>
              {createdAgents.length > 0 ? `${createdAgents.length} agente(s) activo(s)` : "Tus agentes aparecerán aquí"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createdAgents.length > 0 ? (
              <div className="space-y-3">
                {createdAgents.map((agent, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Bot className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{agent}</p>
                        <p className="text-sm text-muted-foreground">Activo</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Configurar</Button>
                      <Button variant="outline" size="sm">Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Bot className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay agentes creados</p>
                <p className="text-sm">Crea tu primer agente usando el formulario</p>
              </div>
            )}
          </CardContent>
        </Card>
          </div>

          {/* Información */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Casos de uso comunes</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Asistente de ventas: responde consultas sobre vehículos</li>
                    <li>• Agente de soporte: ayuda con problemas técnicos</li>
                    <li>• Programador de citas: agenda test drives automáticamente</li>
                    <li>• Analizador de leads: clasifica y prioriza prospectos</li>
                    <li>• Generador de reportes: crea informes automáticos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
