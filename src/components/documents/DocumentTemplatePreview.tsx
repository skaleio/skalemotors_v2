import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentClause, DocumentTemplateSettings } from "@/lib/documents/templateTypes";
import type { DocumentType } from "@/lib/services/documents";
import { cn } from "@/lib/utils";

const DENSITY_PREVIEW = {
  normal: "text-sm space-y-3",
  compact: "text-xs space-y-2",
  minimal: "text-[10px] space-y-1.5 leading-snug",
};

interface DocumentTemplatePreviewProps {
  type: DocumentType;
  templateName: string;
  clauses: DocumentClause[];
  settings: DocumentTemplateSettings;
}

export function DocumentTemplatePreview({
  type,
  templateName,
  clauses,
  settings,
}: DocumentTemplatePreviewProps) {
  const isVenta = type === "contrato_venta";
  const title =
    settings.title ??
    (isVenta ? "CONTRATO DE COMPRAVENTA DE VEHÍCULO" : "CONTRATO DE CONSIGNACIÓN DE VEHÍCULO");

  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col h-full min-h-[420px] rounded-xl border bg-white dark:bg-zinc-950 shadow-inner">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-violet-600 shrink-0" />
          <span className="text-xs font-medium truncate">Vista previa</span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {templateName || "Sin nombre"}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-lg mx-auto">
          <article
            className={cn(
              "text-slate-800 dark:text-zinc-200 font-serif",
              DENSITY_PREVIEW[settings.density]
            )}
          >
            <header className="text-center mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Automotora · Borrador
              </p>
              <h1 className="font-bold text-base leading-tight">{title}</h1>
              <p className="text-xs text-muted-foreground mt-2">N° DOC-0000 · Santiago, {today}</p>
            </header>

            {settings.sections.consignor && !isVenta && (
              <section className="mb-4">
                <h2 className="text-xs font-bold border-b pb-1 mb-2">DATOS DEL CONSIGNANTE</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Nombre</span>
                  <span className="text-foreground">Juan Pérez</span>
                  <span>RUT</span>
                  <span className="text-foreground">12.345.678-9</span>
                </div>
              </section>
            )}

            {settings.sections.vehicle && (
              <section className="mb-4">
                <h2 className="text-xs font-bold border-b pb-1 mb-2">VEHÍCULO</h2>
                <p className="text-xs text-muted-foreground">
                  Toyota Corolla 2020 · Patente ABCD12
                </p>
              </section>
            )}

            {settings.sections.terms && (
              <section>
                <h2 className="text-xs font-bold border-b pb-1 mb-3">CLÁUSULAS</h2>
                {clauses.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Agrega al menos una cláusula para ver el contrato.
                  </p>
                ) : (
                  <ol className="space-y-3 list-none p-0 m-0">
                    {clauses.map((c) => (
                      <li key={c.id} className="text-justify">
                        <p className="font-bold text-xs mb-0.5">{c.title || "—"}</p>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                          {c.body.trim() || (
                            <span className="italic text-muted-foreground">(texto pendiente)</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {settings.sections.signatures && (
              <section className="mt-8 pt-6 border-t border-dashed">
                <div className="grid grid-cols-2 gap-8 text-center text-[10px] text-muted-foreground">
                  <div>
                    <div className="h-8 border-b border-slate-300 mb-1" />
                    Firma consignante
                  </div>
                  <div>
                    <div className="h-8 border-b border-slate-300 mb-1" />
                    Firma consignatario
                  </div>
                </div>
              </section>
            )}
          </article>
        </div>
      </ScrollArea>
    </div>
  );
}
