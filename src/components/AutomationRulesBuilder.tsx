import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Workflow, 
  Save, 
  Plus, 
  Trash2, 
  Edit,
  ArrowRight,
  Zap,
  MessageSquare,
  UserPlus,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import type { AutomationRule } from '@/lib/services/n8n';

interface AutomationRulesBuilderProps {
  rules: AutomationRule[];
  onChange: (rules: AutomationRule[]) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export default function AutomationRulesBuilder({ 
  rules, 
  onChange, 
  onSave, 
  saving 
}: AutomationRulesBuilderProps) {
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createNewRule = (): AutomationRule => ({
    id: `rule_${Date.now()}`,
    name: '',
    enabled: true,
    trigger: {
      type: 'new_message',
      conditions: {}
    },
    actions: []
  });

  const handleCreateRule = () => {
    setEditingRule(createNewRule());
    setIsCreating(true);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    if (isCreating) {
      onChange([...rules, editingRule]);
    } else {
      onChange(rules.map(r => r.id === editingRule.id ? editingRule : r));
    }

    setEditingRule(null);
    setIsCreating(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    onChange(rules.filter(r => r.id !== ruleId));
  };

  const handleToggleRule = (ruleId: string) => {
    onChange(rules.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditingRule({ ...rule });
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsCreating(false);
  };

  const addAction = () => {
    if (!editingRule) return;

    setEditingRule({
      ...editingRule,
      actions: [
        ...editingRule.actions,
        {
          type: 'move_lead_stage',
          params: {}
        }
      ]
    });
  };

  const removeAction = (index: number) => {
    if (!editingRule) return;

    setEditingRule({
      ...editingRule,
      actions: editingRule.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index: number, updates: any) => {
    if (!editingRule) return;

    setEditingRule({
      ...editingRule,
      actions: editingRule.actions.map((action, i) => 
        i === index ? { ...action, ...updates } : action
      )
    });
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'new_message': return <MessageSquare className="h-4 w-4" />;
      case 'lead_inactive': return <Zap className="h-4 w-4" />;
      case 'schedule': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Workflow className="h-4 w-4" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'move_lead_stage': return <TrendingUp className="h-4 w-4" />;
      case 'assign_user': return <UserPlus className="h-4 w-4" />;
      case 'send_message': return <MessageSquare className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getTriggerLabel = (type: string) => {
    const labels: Record<string, string> = {
      'new_message': 'Nuevo mensaje',
      'lead_inactive': 'Lead inactivo',
      'schedule': 'Programado',
      'manual': 'Manual'
    };
    return labels[type] || type;
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      'move_lead_stage': 'Mover etapa del lead',
      'assign_user': 'Asignar vendedor',
      'send_message': 'Enviar mensaje',
      'create_task': 'Crear tarea'
    };
    return labels[type] || type;
  };

  if (editingRule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isCreating ? 'Crear Nueva Regla' : 'Editar Regla'}
          </CardTitle>
          <CardDescription>
            Define el disparador y las acciones automáticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nombre de la regla */}
          <div className="space-y-2">
            <Label htmlFor="rule-name">Nombre de la Regla</Label>
            <Input
              id="rule-name"
              placeholder="Ej: Mover leads calientes a negociación"
              value={editingRule.name}
              onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
            />
          </div>

          <Separator />

          {/* Trigger */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Disparador</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-type">Tipo de Disparador</Label>
              <Select
                value={editingRule.trigger.type}
                onValueChange={(value: any) => setEditingRule({
                  ...editingRule,
                  trigger: { ...editingRule.trigger, type: value }
                })}
              >
                <SelectTrigger id="trigger-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_message">Nuevo mensaje recibido</SelectItem>
                  <SelectItem value="lead_inactive">Lead inactivo por X días</SelectItem>
                  <SelectItem value="schedule">Programado (diario/semanal)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Condiciones del trigger */}
            {editingRule.trigger.type === 'lead_inactive' && (
              <div className="space-y-2">
                <Label htmlFor="inactive-days">Días de inactividad</Label>
                <Input
                  id="inactive-days"
                  type="number"
                  min="1"
                  placeholder="3"
                  value={editingRule.trigger.conditions?.days || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule,
                    trigger: {
                      ...editingRule.trigger,
                      conditions: { days: parseInt(e.target.value) }
                    }
                  })}
                />
              </div>
            )}

            {editingRule.trigger.type === 'new_message' && (
              <div className="space-y-2">
                <Label htmlFor="message-contains">Mensaje contiene (opcional)</Label>
                <Input
                  id="message-contains"
                  placeholder="precio, comprar, test drive"
                  value={editingRule.trigger.conditions?.contains || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule,
                    trigger: {
                      ...editingRule.trigger,
                      conditions: { contains: e.target.value }
                    }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Separa múltiples palabras con comas
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Acciones */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Acciones</h3>
              </div>
              <Button onClick={addAction} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Acción
              </Button>
            </div>

            {editingRule.actions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No hay acciones configuradas</p>
                <p className="text-xs mt-1">Agrega al menos una acción</p>
              </div>
            )}

            {editingRule.actions.map((action, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Acción {index + 1}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Select
                  value={action.type}
                  onValueChange={(value: any) => updateAction(index, { type: value, params: {} })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_lead_stage">Mover etapa del lead</SelectItem>
                    <SelectItem value="assign_user">Asignar vendedor</SelectItem>
                    <SelectItem value="send_message">Enviar mensaje</SelectItem>
                    <SelectItem value="create_task">Crear tarea</SelectItem>
                  </SelectContent>
                </Select>

                {/* Parámetros según el tipo de acción */}
                {action.type === 'move_lead_stage' && (
                  <div className="space-y-2">
                    <Label>Nueva etapa</Label>
                    <Select
                      value={action.params.stage || ''}
                      onValueChange={(value) => updateAction(index, {
                        params: { ...action.params, stage: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nuevo">Nuevo</SelectItem>
                        <SelectItem value="contactado">Contactado</SelectItem>
                        <SelectItem value="calificado">Calificado</SelectItem>
                        <SelectItem value="negociacion">Negociación</SelectItem>
                        <SelectItem value="ganado">Ganado</SelectItem>
                        <SelectItem value="perdido">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {action.type === 'send_message' && (
                  <div className="space-y-2">
                    <Label>Mensaje a enviar</Label>
                    <Input
                      placeholder="Ej: Hola {{name}}, ¿sigues interesado en nuestros vehículos?"
                      value={action.params.message || ''}
                      onChange={(e) => updateAction(index, {
                        params: { ...action.params, message: e.target.value }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usa {'{{name}}'} para el nombre del cliente
                    </p>
                  </div>
                )}

                {action.type === 'assign_user' && (
                  <div className="space-y-2">
                    <Label>Método de asignación</Label>
                    <Select
                      value={action.params.method || 'round_robin'}
                      onValueChange={(value) => updateAction(index, {
                        params: { ...action.params, method: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">Round Robin (rotación)</SelectItem>
                        <SelectItem value="least_busy">Menos ocupado</SelectItem>
                        <SelectItem value="best_performer">Mejor desempeño</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveRule}
              disabled={!editingRule.name || editingRule.actions.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Regla
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Reglas de Automatización
              </CardTitle>
              <CardDescription>
                Configura acciones automáticas basadas en eventos
              </CardDescription>
            </div>
            <Button onClick={handleCreateRule}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Regla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay reglas configuradas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primera regla de automatización para empezar
              </p>
              <Button onClick={handleCreateRule}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Regla
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                        <h4 className="font-semibold">{rule.name}</h4>
                        {!rule.enabled && (
                          <Badge variant="secondary">Desactivada</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getTriggerIcon(rule.trigger.type)}
                          <span>{getTriggerLabel(rule.trigger.type)}</span>
                        </div>
                        <ArrowRight className="h-3 w-3" />
                        <div className="flex items-center gap-1">
                          <span>{rule.actions.length} acción(es)</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {rule.actions.map((action, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {getActionLabel(action.type)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRule(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {rules.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Todas las Reglas'}
          </Button>
        </div>
      )}
    </div>
  );
}
