import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentContractBody } from "@/components/documents/DocumentContractBody";
import {
  consignacionFormToInsert,
  consignacionFormToPreview,
  consignacionFormToUpdate,
  documentToConsignacionForm,
  emptyConsignacionForm,
  type ConsignacionFormState,
} from "@/lib/documents/mappers";
import {
  documentTypeFromQuery,
  resolveConsignacionPrefill,
} from "@/lib/documents/resolvePrefill";
import { mergeLayoutSettings, type DocumentTemplateSettings } from "@/lib/documents/templateTypes";
import { useAuth } from "@/contexts/AuthContext";
import { documentService, Document, DocumentStatus } from "@/lib/services/documents";
import { documentTemplateService } from "@/lib/services/documentTemplates";
import { supabase } from "@/lib/supabase";

export default function DocumentEditor() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const docType = documentTypeFromQuery(searchParams.get("tipo"));
  const isConsignacion = docType === "contrato_consignacion";

  const [form, setForm] = useState<ConsignacionFormState>(emptyConsignacionForm);
  const [doc, setDoc] = useState<Document | null>(null);
  const [layoutSettings, setLayoutSettings] = useState<DocumentTemplateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missingConsignacion, setMissingConsignacion] = useState(false);

  const { data: issuerName } = useQuery({
    queryKey: ["branch-name", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return null;
      const { data } = await supabase
        .from("branches")
        .select("name")
        .eq("id", user.branch_id)
        .single();
      return data?.name ?? null;
    },
    enabled: !!user?.branch_id,
  });

  const { data: template } = useQuery({
    queryKey: ["document-template", docType, user?.branch_id],
    queryFn: () => documentTemplateService.resolveForType(docType, user?.branch_id),
    enabled: !!user,
  });

  const effectiveLayout = useMemo(
    () => mergeLayoutSettings(template?.settings ?? { sections: {}, density: "normal" }, layoutSettings),
    [template, layoutSettings]
  );

  const previewDoc = useMemo((): Document => {
    const base = consignacionFormToPreview(form, {
      document_number: doc?.document_number ?? "BORRADOR",
    });
    return { ...base, layout_settings: effectiveLayout as unknown as Record<string, unknown> };
  }, [form, doc?.document_number, effectiveLayout]);

  useEffect(() => {
    if (!vehicleId || !user) return;
    let cancelled = false;

    const boot = async () => {
      setLoading(true);
      setMissingConsignacion(false);
      try {
        const existing = await documentService.getByVehicleAndType(vehicleId, docType);
        if (cancelled) return;

        if (existing) {
          setDoc(existing);
          if (isConsignacion) {
            setForm(documentToConsignacionForm(existing));
          }
          setLayoutSettings(
            (existing.layout_settings as DocumentTemplateSettings) ??
              mergeLayoutSettings(template?.settings ?? {}, null)
          );
          return;
        }

        if (isConsignacion) {
          const prefill = await resolveConsignacionPrefill(vehicleId, user.branch_id);
          if (cancelled) return;
          if (prefill) {
            setForm(prefill.form);
            const tpl = await documentTemplateService.resolveForType(docType, user.branch_id);
            const created = await documentService.create({
              ...consignacionFormToInsert(prefill.form, {
                branch_id: user.branch_id ?? null,
                tenant_id: user.tenant_id ?? null,
                created_by: user.id ?? null,
                status: "borrador",
              }),
              type: docType,
              template_id: tpl.id !== "builtin" ? tpl.id : null,
              layout_settings: tpl.settings as unknown as Record<string, unknown>,
            });
            if (!cancelled) {
              setDoc(created);
              setLayoutSettings(tpl.settings);
            }
          } else {
            setMissingConsignacion(true);
            setForm((f) => ({ ...f, vehicle_id: vehicleId }));
          }
        }
      } catch {
        toast.error("No se pudo cargar el documento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, user?.id, user?.branch_id, user?.tenant_id, docType, isConsignacion]);

  const persist = async (status: DocumentStatus) => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await documentService.update(doc.id, {
        ...consignacionFormToUpdate(form),
        status,
        layout_settings: effectiveLayout as unknown as Record<string, unknown>,
        template_id: template && template.id !== "builtin" ? template.id : doc.template_id,
      });
      setDoc(updated);
      toast.success(status === "borrador" ? "Borrador guardado" : "Contrato generado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content || !doc) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${doc.document_number}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#000}</style></head>
      <body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const toggleSection = (key: keyof typeof effectiveLayout.sections, value: boolean) => {
    setLayoutSettings((prev) => {
      const base = prev ?? template?.settings ?? mergeLayoutSettings({}, null);
      return {
        ...base,
        sections: { ...base.sections, [key]: value },
      };
    });
  };

  const setDensity = (density: "normal" | "compact" | "minimal") => {
    setLayoutSettings((prev) => ({
      ...(prev ?? template?.settings ?? mergeLayoutSettings({}, null)),
      density,
    }));
  };

  if (!vehicleId) {
    return null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="border-b bg-background px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/documents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold truncate">
              {isConsignacion ? "Contrato de consignación" : "Contrato de venta"}
              {doc?.document_number ? ` — ${doc.document_number}` : ""}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {[form.vehicle_make, form.vehicle_model, form.vehicle_year, form.vehicle_patente]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" disabled={saving || !doc} onClick={() => persist("borrador")}>
            <Save className="h-4 w-4 mr-1" />
            Guardar
          </Button>
          <Button
            size="sm"
            className="bg-pink-600 hover:bg-pink-700 text-white"
            disabled={saving || !doc}
            onClick={() => persist("generado")}
          >
            Generar
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-zinc-900 p-6">
            {missingConsignacion && (
              <Alert className="mb-4 max-w-3xl mx-auto border-amber-200 bg-amber-50">
                <AlertDescription>
                  No encontramos una consignación activa para este vehículo. Los datos del auto pueden
                  estar incompletos; revisa el módulo Consignaciones o vincula la patente.
                </AlertDescription>
              </Alert>
            )}
            <div
              ref={printRef}
              className="max-w-3xl mx-auto bg-white text-black p-8 shadow-lg rounded-lg"
            >
              <DocumentContractBody
                doc={previewDoc}
                template={template ?? undefined}
                issuerName={issuerName ?? undefined}
              />
            </div>
          </main>

          <aside className="w-72 border-l bg-background p-4 overflow-y-auto shrink-0 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Configuración rápida
            </p>
            <div className="flex gap-1">
              {(["normal", "compact", "minimal"] as const).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={effectiveLayout.density === d ? "default" : "outline"}
                  className="flex-1 text-xs capitalize"
                  onClick={() => setDensity(d)}
                >
                  {d === "normal" ? "Normal" : d === "compact" ? "Compacto" : "Mínimo"}
                </Button>
              ))}
            </div>
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Datos del contrato</p>
              <div className="space-y-2">
                <Label className="text-xs">Consignante</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.owner_name}
                  onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                />
                <Input
                  className="h-8 text-xs"
                  placeholder="RUT"
                  value={form.owner_rut}
                  onChange={(e) => setForm((f) => ({ ...f, owner_rut: e.target.value }))}
                />
                <Input
                  className="h-8 text-xs"
                  placeholder="Teléfono"
                  value={form.owner_phone}
                  onChange={(e) => setForm((f) => ({ ...f, owner_phone: e.target.value }))}
                />
                <Input
                  className="h-8 text-xs"
                  type="email"
                  placeholder="Email"
                  value={form.owner_email}
                  onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))}
                />
                <Input
                  className="h-8 text-xs"
                  placeholder="Dirección"
                  value={form.owner_address}
                  onChange={(e) => setForm((f) => ({ ...f, owner_address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Precio sugerido</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Precio mínimo</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={form.min_sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, min_sale_price: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Secciones</p>
              {(
                [
                  ["consignor", "Datos del consignante"],
                  ["vehicle", "Datos del vehículo"],
                  ["consignment_details", "Detalles de la consignación"],
                  ["terms", "Términos y condiciones"],
                  ["signatures", "Firmas"],
                  ["observations", "Observaciones"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-normal">{label}</Label>
                  <Switch
                    checked={effectiveLayout.sections[key]}
                    onCheckedChange={(v) => toggleSection(key, v)}
                  />
                </div>
              ))}
            </div>
            <div className="pt-2 space-y-2 border-t">
              <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  if (!vehicleId) return;
                  void resolveConsignacionPrefill(vehicleId, user?.branch_id).then((p) => {
                    if (p) {
                      setForm(p.form);
                      toast.success("Datos actualizados desde consignación");
                    }
                  });
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Refrescar desde consignación
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Plantilla: {template?.name ?? "Sistema"}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
