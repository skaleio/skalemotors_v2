import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeIntegerInput } from '@/lib/format';
import type { AIAgentConfig } from '@/lib/services/n8n';
import {
    AlertTriangle,
    BookOpen,
    Bot,
    Clock,
    MessageSquare,
    Plus,
    Save,
    Trash2
} from 'lucide-react';
import { useState } from 'react';

interface AIAgentBuilderProps {
  config: AIAgentConfig;
  onChange: (config: AIAgentConfig) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export default function AIAgentBuilder({ config, onChange, onSave, saving }: AIAgentBuilderProps) {
  const [newFAQ, setNewFAQ] = useState({ question: '', answer: '' });
  const [newAutoResponse, setNewAutoResponse] = useState({
    trigger: '',
    response_template: '',
    requires_human: false
  });
  const [newEscalationKeyword, setNewEscalationKeyword] = useState('');

  const updateConfig = (updates: Partial<AIAgentConfig>) => {
    onChange({ ...config, ...updates });
  };

  const addFAQ = () => {
    if (!newFAQ.question || !newFAQ.answer) return;

    const faqs = [...(config.knowledge_base?.faqs || []), newFAQ];
    updateConfig({
      knowledge_base: {
        ...config.knowledge_base,
        faqs
      }
    });
    setNewFAQ({ question: '', answer: '' });
  };

  const removeFAQ = (index: number) => {
    const faqs = config.knowledge_base?.faqs?.filter((_, i) => i !== index) || [];
    updateConfig({
      knowledge_base: {
        ...config.knowledge_base,
        faqs
      }
    });
  };

  const addAutoResponse = () => {
    if (!newAutoResponse.trigger || !newAutoResponse.response_template) return;

    const rules = [...(config.auto_response_rules || []), newAutoResponse];
    updateConfig({ auto_response_rules: rules });
    setNewAutoResponse({ trigger: '', response_template: '', requires_human: false });
  };

  const removeAutoResponse = (index: number) => {
    const rules = config.auto_response_rules?.filter((_, i) => i !== index) || [];
    updateConfig({ auto_response_rules: rules });
  };

  const addEscalationKeyword = () => {
    if (!newEscalationKeyword) return;

    const keywords = [...(config.escalation_rules?.keywords || []), newEscalationKeyword];
    updateConfig({
      escalation_rules: {
        ...config.escalation_rules,
        keywords
      }
    });
    setNewEscalationKeyword('');
  };

  const removeEscalationKeyword = (index: number) => {
    const keywords = config.escalation_rules?.keywords?.filter((_, i) => i !== index) || [];
    updateConfig({
      escalation_rules: {
        ...config.escalation_rules,
        keywords
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuración Básica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuración Básica del Agente
          </CardTitle>
          <CardDescription>
            Define la personalidad y comportamiento de tu asistente virtual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Nombre del Agente</Label>
              <Input
                id="agent-name"
                placeholder="Asistente Virtual"
                value={config.name || ''}
                onChange={(e) => updateConfig({ name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personality">Personalidad</Label>
              <Select
                value={config.personality}
                onValueChange={(value: any) => updateConfig({ personality: value })}
              >
                <SelectTrigger id="personality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal - Profesional y cortés</SelectItem>
                  <SelectItem value="casual">Casual - Amigable y cercano</SelectItem>
                  <SelectItem value="tecnico">Técnico - Detallado y específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Idioma</Label>
              <Select
                value={config.language}
                onValueChange={(value: any) => updateConfig({ language: value })}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es-CL">Español (Chile)</SelectItem>
                  <SelectItem value="es-MX">Español (México)</SelectItem>
                  <SelectItem value="es-ES">Español (España)</SelectItem>
                  <SelectItem value="es-AR">Español (Argentina)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-response">Respuestas Automáticas</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-response"
                  checked={config.auto_response_enabled}
                  onCheckedChange={(checked) => updateConfig({ auto_response_enabled: checked })}
                />
                <Label htmlFor="auto-response" className="font-normal cursor-pointer">
                  {config.auto_response_enabled ? 'Activadas' : 'Desactivadas'}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horario de Respuesta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horario de Respuesta
          </CardTitle>
          <CardDescription>
            Define cuándo el agente responderá automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Hora de Inicio</Label>
              <Input
                id="start-time"
                type="time"
                value={config.response_hours?.start || '09:00'}
                onChange={(e) => updateConfig({
                  response_hours: {
                    ...config.response_hours,
                    start: e.target.value
                  }
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-time">Hora de Fin</Label>
              <Input
                id="end-time"
                type="time"
                value={config.response_hours?.end || '18:00'}
                onChange={(e) => updateConfig({
                  response_hours: {
                    ...config.response_hours,
                    end: e.target.value
                  }
                })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Fuera de este horario, se enviará un mensaje automático indicando que responderás pronto.
          </p>
        </CardContent>
      </Card>

      {/* Base de Conocimiento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Base de Conocimiento
          </CardTitle>
          <CardDescription>
            Configura qué información puede usar el agente para responder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Catálogo de Vehículos</Label>
                <p className="text-xs text-muted-foreground">
                  Permitir consultas sobre vehículos disponibles
                </p>
              </div>
              <Switch
                checked={config.knowledge_base?.vehicle_catalog_enabled}
                onCheckedChange={(checked) => updateConfig({
                  knowledge_base: {
                    ...config.knowledge_base,
                    vehicle_catalog_enabled: checked
                  }
                })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Rangos de Precios</Label>
                <p className="text-xs text-muted-foreground">
                  Permitir consultas sobre precios (rangos generales)
                </p>
              </div>
              <Switch
                checked={config.knowledge_base?.price_ranges_enabled}
                onCheckedChange={(checked) => updateConfig({
                  knowledge_base: {
                    ...config.knowledge_base,
                    price_ranges_enabled: checked
                  }
                })}
              />
            </div>
          </div>

          <Separator />

          {/* FAQs */}
          <div className="space-y-3">
            <Label>Preguntas Frecuentes (FAQs)</Label>

            {config.knowledge_base?.faqs && config.knowledge_base.faqs.length > 0 && (
              <div className="space-y-2">
                {config.knowledge_base.faqs.map((faq, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{faq.question}</p>
                        <p className="text-xs text-muted-foreground mt-1">{faq.answer}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFAQ(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
              <Input
                placeholder="Pregunta (ej: ¿Cuál es el horario de atención?)"
                value={newFAQ.question}
                onChange={(e) => setNewFAQ({ ...newFAQ, question: e.target.value })}
              />
              <Textarea
                placeholder="Respuesta..."
                value={newFAQ.answer}
                onChange={(e) => setNewFAQ({ ...newFAQ, answer: e.target.value })}
                rows={2}
              />
              <Button onClick={addFAQ} size="sm" variant="secondary" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Agregar FAQ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reglas de Respuesta Automática */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reglas de Respuesta Automática
          </CardTitle>
          <CardDescription>
            Define respuestas automáticas basadas en palabras clave
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.auto_response_rules && config.auto_response_rules.length > 0 && (
            <div className="space-y-2">
              {config.auto_response_rules.map((rule, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {rule.trigger}
                        </Badge>
                        {rule.requires_human && (
                          <Badge variant="outline" className="text-xs">
                            Requiere humano
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.response_template}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAutoResponse(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
            <Input
              placeholder="Palabras clave (ej: hola|buenos días|buenas tardes)"
              value={newAutoResponse.trigger}
              onChange={(e) => setNewAutoResponse({ ...newAutoResponse, trigger: e.target.value })}
            />
            <Textarea
              placeholder="Plantilla de respuesta (usa {{branch_name}} para el nombre de la sucursal)"
              value={newAutoResponse.response_template}
              onChange={(e) => setNewAutoResponse({ ...newAutoResponse, response_template: e.target.value })}
              rows={2}
            />
            <div className="flex items-center space-x-2">
              <Switch
                id="requires-human"
                checked={newAutoResponse.requires_human}
                onCheckedChange={(checked) => setNewAutoResponse({ ...newAutoResponse, requires_human: checked })}
              />
              <Label htmlFor="requires-human" className="text-xs font-normal cursor-pointer">
                Requiere seguimiento humano
              </Label>
            </div>
            <Button onClick={addAutoResponse} size="sm" variant="secondary" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Regla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reglas de Escalación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reglas de Escalación
          </CardTitle>
          <CardDescription>
            Define cuándo derivar a un asesor humano
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Palabras clave de escalación</Label>
            <p className="text-xs text-muted-foreground">
              Si el cliente menciona estas palabras, se notificará a un asesor
            </p>

            {config.escalation_rules?.keywords && config.escalation_rules.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.escalation_rules.keywords.map((keyword, index) => (
                  <Badge key={index} variant="destructive" className="gap-1">
                    {keyword}
                    <button
                      onClick={() => removeEscalationKeyword(index)}
                      className="ml-1 hover:bg-destructive-foreground/20 rounded-full"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Nueva palabra clave"
                value={newEscalationKeyword}
                onChange={(e) => setNewEscalationKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addEscalationKeyword()}
              />
              <Button onClick={addEscalationKeyword} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="inactive-hours">Tiempo de inactividad (horas)</Label>
            <Input
              id="inactive-hours"
              type="text"
              inputMode="numeric"
              min="1"
              max="168"
              value={config.escalation_rules?.inactive_hours ?? ''}
              onChange={(e) => updateConfig({
                escalation_rules: {
                  ...config.escalation_rules,
                  inactive_hours: (() => {
                    const cleaned = sanitizeIntegerInput(e.target.value);
                    return cleaned ? parseInt(cleaned, 10) : undefined;
                  })()
                }
              })}
            />
            <p className="text-xs text-muted-foreground">
              Si un lead no responde en este tiempo, se notificará al vendedor asignado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botón Guardar */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración del Agente IA'}
        </Button>
      </div>
    </div>
  );
}
