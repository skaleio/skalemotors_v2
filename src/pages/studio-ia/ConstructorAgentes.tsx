import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, RefreshCw, CheckCircle2, Plus, Trash2, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AgentData {
  name: string;
  purpose: string;
  tasks: string[];
  integration: string;
  behavior: string;
  responseStyle: string;
}

export default function ConstructorAgentes() {
  const [loading, setLoading] = useState(false);
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
      toast({
        title: "Campos requeridos",
        description: "Por favor, completa el nombre y propósito del agente.",
        variant: "destructive"
      });
      return;
    }

    if (formData.tasks.length === 0) {
      toast({
        title: "Tareas requeridas",
        description: "Agrega al menos una tarea para el agente.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCreatedAgents(prev => [...prev, formData.name]);
      
      toast({
        title: "Agente creado",
        description: `El agente "${formData.name}" ha sido creado exitosamente.`,
      });

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
      toast({
        title: "Error",
        description: "No se pudo crear el agente. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
          Crea agentes de IA personalizados para automatizar tareas específicas de tu automotora
        </p>
      </div>

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
              disabled={loading || !formData.name.trim() || !formData.purpose.trim() || formData.tasks.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
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
    </div>
  );
}
