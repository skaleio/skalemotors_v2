import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
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
  documentToVentaForm,
  emptyConsignacionForm,
  emptyVentaForm,
  ventaFormToInsert,
  ventaFormToPreview,
  ventaFormToUpdate,
  type ConsignacionFormState,
  type VentaFormState,
} from "@/lib/documents/mappers";
import {
  documentTypeFromQuery,
  resolveConsignacionPrefill,
  resolveVentaPrefill,
} from "@/lib/documents/resolvePrefill";
import { mergeLayoutSettings, type DocumentTemplateSettings } from "@/lib/documents/templateTypes";
import { useAuth } from "@/contexts/AuthContext";
import { documentService, Document, DocumentStatus } from "@/lib/services/documents";
import { documentTemplateService } from "@/lib/services/documentTemplates";
import { supabase } from "@/lib/supabase";

type AnyForm = ConsignacionFormState | VentaFormState;

const CONSIGNACION_SECTIONS = [
  ["consignor", "Datos del consignante"],
  ["vehicle", "Datos del vehículo"],
  ["consignment_details", "Detalles de la consignación"],
  ["terms", "Términos y condiciones"],
  ["signatures", "Firmas"],
  ["observations", "Observaciones"],
] as const;

const VENTA_SECTIONS = [
  ["buyer", "Datos del comprador"],
  ["vehicle", "Datos del vehículo"],
  ["economic", "Condiciones económicas"],
  ["terms", "Términos y condiciones"],
  ["signatures", "Firmas"],
  ["observations", "Observaciones"],
] as const;

export default function DocumentEditor() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const docType = documentTypeFromQuery(searchParams.get("tipo"));
  const isConsignacion = docType === "contrato_consignacion";

  const [form, setForm] = useState<AnyForm>(
    isConsignacion ? emptyConsignacionForm() : emptyVentaForm()
  );
  const [doc, setDoc] = useState<Document | null>(null);
  const [layoutSettings, setLayoutSettings] = useState<DocumentTemplateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missingConsignacion, setMissingConsignacion] = useState(false);

  const cForm = form as ConsignacionFormState;
  const vForm = form as VentaFormState;

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
    const base = isConsignacion
      ? consignacionFormToPreview(form as ConsignacionFormState, {
          document_number: doc?.document_number ?? "BORRADOR",
        })
      : ventaFormToPreview(form as VentaFormState, {
          document_number: doc?.document_number ?? "BORRADOR",
        });
    return { ...base, layout_settings: effectiveLayout as unknown as Record<string, unknown> };
  }, [form, doc?.document_number, effectiveLayout, isConsignacion]);

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
          setForm(
            isConsignacion ? documentToConsignacionForm(existing) : documentToVentaForm(existing)
          );
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
            setForm((f) => ({ ...(f as ConsignacionFormState), vehicle_id: vehicleId }));
          }
          return;
        }

        // Nota de venta: el vehículo siempre alcanza para autorrellenar.
        const prefill = await resolveVentaPrefill(vehicleId, user.branch_id);
        if (cancelled) return;
        setForm(prefill.form);
        const tpl = await documentTemplateService.resolveForType(docType, user.branch_id);
        const created = await documentService.create({
          ...ventaFormToInsert(prefill.form, {
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
      const fields = isConsignacion
        ? consignacionFormToUpdate(form as ConsignacionFormState)
        : ventaFormToUpdate(form as VentaFormState);
      const updated = await documentService.update(doc.id, {
        ...fields,
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

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!printRef.current || !doc) return;
    setDownloadingPdf(true);
    try {
      const { downloadDocumentPdf } = await import("@/lib/pdf/documentPdf");
      await downloadDocumentPdf(printRef.current, doc.document_number ?? "documento");
    } catch {
      toast.error("No se pudo generar el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content || !doc) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    // Copiamos los estilos de la app para que el documento impreso conserve el diseño.
    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join("\n");
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${doc.document_number}</title>${headStyles}` +
        `<style>@page{margin:14mm} body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif}` +
        `.doc-print{max-width:800px;margin:0 auto;padding:8px;color:#000}</style>` +
        `</head><body><div class="doc-print">${content}</div></body></html>`
    );
    win.document.close();
    const triggerPrint = () => {
      win.focus();
      win.print();
    };
    if (win.document.readyState === "complete") {
      setTimeout(triggerPrint, 350);
    } else {
      win.onload = () => setTimeout(triggerPrint, 350);
    }
  };

  const handleRefresh = () => {
    if (!vehicleId) return;
    if (isConsignacion) {
      void resolveConsignacionPrefill(vehicleId, user?.branch_id).then((p) => {
        if (p) {
          setForm(p.form);
          toast.success("Datos actualizados desde consignación");
        }
      });
      return;
    }
    void resolveVentaPrefill(vehicleId, user?.branch_id).then((p) => {
      // Refresca datos del vehículo conservando lo que se haya escrito del comprador.
      setForm((f) => {
        const cur = f as VentaFormState;
        return {
          ...p.form,
          buyer_name: cur.buyer_name,
          buyer_rut: cur.buyer_rut,
          buyer_phone: cur.buyer_phone,
          buyer_email: cur.buyer_email,
          buyer_address: cur.buyer_address,
          down_payment: cur.down_payment,
          payment_method: cur.payment_method,
        };
      });
      toast.success("Datos del vehículo actualizados");
    });
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

  const sectionList = isConsignacion ? CONSIGNACION_SECTIONS : VENTA_SECTIONS;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="border-b bg-background px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/documents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold truncate">
              {isConsignacion ? "Contrato de consignación" : "Nota de venta"}
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

            {isConsignacion ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Datos del consignante</p>
                <div className="space-y-2">
                  <Label className="text-xs">Consignante</Label>
                  <Input
                    className="h-8 text-xs"
                    value={cForm.owner_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as ConsignacionFormState), owner_name: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="RUT"
                    value={cForm.owner_rut}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as ConsignacionFormState), owner_rut: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Teléfono"
                    value={cForm.owner_phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as ConsignacionFormState), owner_phone: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    type="email"
                    placeholder="Email"
                    value={cForm.owner_email}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as ConsignacionFormState), owner_email: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Dirección"
                    value={cForm.owner_address}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as ConsignacionFormState), owner_address: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Precio sugerido</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={cForm.sale_price}
                      onChange={(e) =>
                        setForm((f) => ({ ...(f as ConsignacionFormState), sale_price: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Precio mínimo</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={cForm.min_sale_price}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...(f as ConsignacionFormState),
                          min_sale_price: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Datos del comprador</p>
                <div className="space-y-2">
                  <Label className="text-xs">Comprador</Label>
                  <Input
                    className="h-8 text-xs"
                    value={vForm.buyer_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), buyer_name: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="RUT"
                    value={vForm.buyer_rut}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), buyer_rut: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Teléfono"
                    value={vForm.buyer_phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), buyer_phone: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    type="email"
                    placeholder="Email"
                    value={vForm.buyer_email}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), buyer_email: e.target.value }))
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Dirección"
                    value={vForm.buyer_address}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), buyer_address: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Precio de venta</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={vForm.sale_price}
                      onChange={(e) =>
                        setForm((f) => ({ ...(f as VentaFormState), sale_price: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Pie / abono</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={vForm.down_payment}
                      onChange={(e) =>
                        setForm((f) => ({ ...(f as VentaFormState), down_payment: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saldo restante</span>
                  <span className="font-medium text-foreground">
                    {new Intl.NumberFormat("es-CL", {
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    }).format(
                      Math.max(
                        0,
                        (parseFloat(vForm.sale_price) || 0) - (parseFloat(vForm.down_payment) || 0)
                      )
                    )}
                  </span>
                </div>
                <div>
                  <Label className="text-xs">Forma de pago</Label>
                  <Input
                    className="h-8 text-xs"
                    value={vForm.payment_method}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as VentaFormState), payment_method: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Secciones</p>
              {sectionList.map(([key, label]) => (
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
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                <Download className="h-4 w-4" />
                {downloadingPdf ? "Generando…" : "Descargar PDF"}
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                {isConsignacion ? "Refrescar desde consignación" : "Refrescar desde vehículo"}
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
