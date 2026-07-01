import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileSignature,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { documentTemplateService } from "@/lib/services/documentTemplates";
import {
  DEFAULT_CONSIGNACION_CLAUSES,
  DEFAULT_VENTA_CLAUSES,
} from "@/lib/documents/defaultTemplates";
import {
  DEFAULT_SECTIONS,
  type DocumentClause,
  type DocumentTemplate,
  type DocumentTemplateSections,
  type DocumentTemplateSettings,
} from "@/lib/documents/templateTypes";
import type { DocumentType } from "@/lib/services/documents";
import { DocumentTemplateClauseCard } from "@/components/documents/DocumentTemplateClauseCard";
import { DocumentTemplatePreview } from "@/components/documents/DocumentTemplatePreview";

interface Props {
  tenantId?: string;
  branchId?: string | null;
}

type SelectionId = string | "new" | "builtin";

const TYPE_META: Record<
  DocumentType,
  { label: string; short: string; description: string }
> = {
  contrato_consignacion: {
    label: "Consignación",
    short: "Consignación",
    description: "Contrato entre propietario y automotora para vender en consigna.",
  },
  contrato_venta: {
    label: "Compraventa",
    short: "Venta",
    description: "Contrato de venta directa del vehículo al comprador.",
  },
  nota_reserva: {
    label: "Nota de reserva",
    short: "Reserva",
    description: "Reserva del vehículo con monto fijo de $200.000 y fecha de vencimiento.",
  },
};

const SECTION_LABELS: { key: keyof DocumentTemplateSections; label: string }[] = [
  { key: "consignor", label: "Datos consignante" },
  { key: "vehicle", label: "Datos vehículo" },
  { key: "consignment_details", label: "Detalle consignación" },
  { key: "buyer", label: "Datos comprador" },
  { key: "economic", label: "Condiciones económicas" },
  { key: "terms", label: "Cláusulas legales" },
  { key: "signatures", label: "Firmas" },
  { key: "observations", label: "Observaciones" },
];

function cloneClauses(clauses: DocumentClause[]): DocumentClause[] {
  return clauses.map((c) => ({ ...c }));
}

function builtinFor(type: DocumentType): DocumentClause[] {
  return cloneClauses(
    type === "contrato_consignacion" ? DEFAULT_CONSIGNACION_CLAUSES : DEFAULT_VENTA_CLAUSES
  );
}

function snapshotState(
  name: string,
  clauses: DocumentClause[],
  settings: DocumentTemplateSettings
) {
  return JSON.stringify({ name, clauses, settings });
}

export function DocumentTemplatesPanel({ tenantId, branchId }: Props) {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<DocumentType>("contrato_consignacion");
  const [selectedId, setSelectedId] = useState<SelectionId>("builtin");
  const [templateName, setTemplateName] = useState("Plantilla principal");
  const [clauses, setClauses] = useState<DocumentClause[]>(() =>
    cloneClauses(DEFAULT_CONSIGNACION_CLAUSES)
  );
  const [settings, setSettings] = useState<DocumentTemplateSettings>({
    sections: { ...DEFAULT_SECTIONS },
    density: "normal",
    title: undefined,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshotState("Plantilla principal", cloneClauses(DEFAULT_CONSIGNACION_CLAUSES), {
      sections: { ...DEFAULT_SECTIONS },
      density: "normal",
    })
  );

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", tenantId],
    queryFn: () => documentTemplateService.list(),
    enabled: !!tenantId,
  });

  const ofType = useMemo(
    () => templates.filter((t) => t.type === activeType),
    [templates, activeType]
  );

  const defaultTemplate = ofType.find((t) => t.is_default);

  const isDirty = useMemo(
    () => snapshotState(templateName, clauses, settings) !== savedSnapshot,
    [templateName, clauses, settings, savedSnapshot]
  );

  const applyTemplate = useCallback(
    (t: DocumentTemplate | null, mode: SelectionId) => {
      const builtin = builtinFor(activeType);
      if (!t || mode === "builtin") {
        setSelectedId("builtin");
        setTemplateName("Plantilla principal");
        setClauses(builtin);
        setSettings({ sections: { ...DEFAULT_SECTIONS }, density: "normal", title: undefined });
        setSavedSnapshot(
          snapshotState("Plantilla principal", builtin, {
            sections: { ...DEFAULT_SECTIONS },
            density: "normal",
          })
        );
        setExpandedId(builtin[0]?.id ?? null);
        return;
      }

      const loaded = t.clauses.length ? cloneClauses(t.clauses) : builtin;
      const loadedSettings = t.settings ?? {
        sections: { ...DEFAULT_SECTIONS },
        density: "normal" as const,
      };

      setSelectedId(t.id);
      setTemplateName(t.name);
      setClauses(loaded);
      setSettings(loadedSettings);
      setSavedSnapshot(snapshotState(t.name, loaded, loadedSettings));
      setExpandedId(loaded[0]?.id ?? null);
    },
    [activeType]
  );

  const didInitRef = useRef(false);
  useEffect(() => {
    if (isLoading || didInitRef.current) return;
    didInitRef.current = true;
    const def = templates.find((t) => t.type === activeType && t.is_default);
    if (def) applyTemplate(def, def.id);
    else applyTemplate(null, "builtin");
  }, [isLoading, templates, activeType, applyTemplate]);

  const handleTypeChange = (type: DocumentType) => {
    setActiveType(type);
    const def = templates.find((t) => t.type === type && t.is_default);
    if (def) applyTemplate(def, def.id);
    else applyTemplate(null, "builtin");
  };

  const handleSelect = (id: SelectionId) => {
    if (id === "builtin") {
      applyTemplate(null, "builtin");
      return;
    }
    if (id === "new") {
      const builtin = builtinFor(activeType);
      setSelectedId("new");
      setTemplateName("Nueva plantilla");
      setClauses(builtin);
      setSettings({ sections: { ...DEFAULT_SECTIONS }, density: "normal" });
      setExpandedId(builtin[0]?.id ?? null);
      return;
    }
    const t = ofType.find((x) => x.id === id);
    if (t) applyTemplate(t, t.id);
  };

  const restoreBuiltin = () => {
    const builtin = builtinFor(activeType);
    setClauses(builtin);
    setExpandedId(builtin[0]?.id ?? null);
    toast.message("Cláusulas restauradas al texto base del sistema");
  };

  const updateClause = (index: number, patch: Partial<DocumentClause>) => {
    setClauses((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const moveClause = (index: number, dir: -1 | 1) => {
    setClauses((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeClause = (index: number) => {
    setClauses((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (expandedId === removed.id) setExpandedId(next[0]?.id ?? null);
      return next;
    });
  };

  const addClause = () => {
    const id = `clause-${Date.now()}`;
    const titles = ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO"];
    const title = titles[clauses.length] ?? `CLÁUSULA ${clauses.length + 1}`;
    setClauses((prev) => [...prev, { id, title, body: "" }]);
    setExpandedId(id);
  };

  const save = async () => {
    if (!tenantId) return;
    const empty = clauses.some((c) => !c.body.trim());
    if (empty) {
      toast.error("Completa el texto de todas las cláusulas antes de guardar");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedId === "new" || selectedId === "builtin") {
        const created = await documentTemplateService.create({
          tenant_id: tenantId,
          branch_id: branchId,
          type: activeType,
          name: templateName.trim() || "Plantilla principal",
          is_default: true,
          clauses,
          settings,
        });
        setSelectedId(created.id);
        toast.success("Plantilla guardada y activada para tu automotora");
      } else {
        await documentTemplateService.update(selectedId, {
          name: templateName.trim(),
          clauses,
          settings,
        });
        toast.success("Cambios guardados");
      }
      setSavedSnapshot(snapshotState(templateName, clauses, settings));
      qc.invalidateQueries({ queryKey: ["document-templates"] });
    } catch {
      toast.error("No se pudo guardar la plantilla");
    } finally {
      setIsSaving(false);
    }
  };

  const meta = TYPE_META[activeType];

  return (
    <div className="rounded-2xl border bg-gradient-to-b from-violet-50/80 to-background dark:from-violet-950/20 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-600/25">
              <ScrollText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Plantillas legales</h2>
              <p className="text-sm text-muted-foreground max-w-xl mt-0.5">
                Personaliza las cláusulas y secciones que verán tus vendedores al generar contratos.
                Los cambios aplican a documentos nuevos de tu automotora.
              </p>
            </div>
          </div>
          {isDirty && (
            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-900 border-amber-200">
              Cambios sin guardar
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] min-h-[560px]">
        {/* Sidebar */}
        <aside className="border-b lg:border-b-0 lg:border-r bg-muted/20 p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Tipo de contrato
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(TYPE_META) as DocumentType[]).map((type) => {
                const m = TYPE_META[type];
                const active = activeType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={cn(
                      "text-left rounded-xl border px-3 py-2.5 transition-all",
                      active
                        ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-600/20"
                        : "border-transparent bg-background hover:border-violet-200 hover:bg-violet-50/50 dark:hover:bg-violet-950/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="font-semibold text-sm">{m.label}</span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] mt-1 leading-snug",
                        active ? "text-violet-100" : "text-muted-foreground"
                      )}
                    >
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Versión guardada
            </Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleSelect("builtin")}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors",
                    selectedId === "builtin"
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40"
                      : "border-transparent hover:bg-muted"
                  )}
                >
                  <span className="font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                    Texto base del sistema
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Sin guardar en tu cuenta
                  </span>
                </button>

                {ofType.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect(t.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors",
                      selectedId === t.id
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40"
                        : "border-transparent hover:bg-muted"
                    )}
                  >
                    <span className="font-medium truncate block">{t.name}</span>
                    {t.is_default && (
                      <Badge className="mt-1 h-5 text-[10px] bg-violet-600">Activa</Badge>
                    )}
                  </button>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-1.5 border-dashed"
                  onClick={() => handleSelect("new")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva plantilla
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Editor */}
        <div className="flex flex-col min-h-0">
          <div className="p-4 sm:p-5 space-y-4 border-b bg-background/80">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="template-name">Nombre de la plantilla</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej. Consignación Miami Motors 2026"
                  className="max-w-md"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={restoreBuiltin}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar cláusulas base
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Opciones del documento
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título del contrato (opcional)</Label>
                  <Input
                    value={settings.title ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        title: e.target.value.trim() || undefined,
                      }))
                    }
                    placeholder={meta.label === "Consignación" ? "CONTRATO DE CONSIGNACIÓN…" : "CONTRATO DE COMPRAVENTA…"}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Densidad al imprimir</Label>
                  <Select
                    value={settings.density}
                    onValueChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        density: v as DocumentTemplateSettings["density"],
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal — lectura cómoda</SelectItem>
                      <SelectItem value="compact">Compacta — menos páginas</SelectItem>
                      <SelectItem value="minimal">Mínima — máximo en una hoja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SECTION_LABELS.map(({ key, label }) => {
                  if (
                    activeType === "contrato_consignacion" &&
                    key === "buyer"
                  ) {
                    return null;
                  }
                  if (
                    activeType === "contrato_venta" &&
                    (key === "consignor" || key === "consignment_details")
                  ) {
                    return null;
                  }
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <span className="text-[11px] leading-tight">{label}</span>
                      <Switch
                        checked={settings.sections[key]}
                        onCheckedChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            sections: { ...s.sections, [key]: checked },
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 grid xl:grid-cols-2 min-h-0">
            <div className="flex flex-col border-b xl:border-b-0 xl:border-r min-h-[360px]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
                <span className="text-sm font-medium">
                  Cláusulas ({clauses.length})
                </span>
                <Button type="button" size="sm" variant="secondary" className="gap-1 h-8" onClick={addClause}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {clauses.map((clause, index) => (
                    <DocumentTemplateClauseCard
                      key={clause.id}
                      clause={clause}
                      index={index}
                      total={clauses.length}
                      open={expandedId === clause.id}
                      onOpenChange={(open) => setExpandedId(open ? clause.id : null)}
                      onChange={(patch) => updateClause(index, patch)}
                      onMoveUp={() => moveClause(index, -1)}
                      onMoveDown={() => moveClause(index, 1)}
                      onRemove={() => removeClause(index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="p-4 bg-muted/10 min-h-[360px]">
              <DocumentTemplatePreview
                type={activeType}
                templateName={templateName}
                clauses={clauses}
                settings={settings}
              />
            </div>
          </div>

          <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedId === "builtin"
                ? "Al guardar, esta plantilla reemplazará el texto base para tu automotora."
                : defaultTemplate && selectedId === defaultTemplate.id
                  ? "Los contratos nuevos usarán esta versión al generarse."
                  : "Guarda para activar esta plantilla en tu tenant."}
            </p>
            <Button
              onClick={save}
              disabled={isSaving || !isDirty}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar plantilla
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
