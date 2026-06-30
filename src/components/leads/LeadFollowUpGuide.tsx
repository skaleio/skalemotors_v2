import { Phone, MessageCircle, Clock, CalendarClock, AlertTriangle } from "lucide-react";

import { getLeadCrmStageKey, CRM_PIPELINE_STATUS_LABELS } from "@/lib/crmPipeline";

// Campos del lead que alimentan la guía (subconjunto de la fila `leads`).
type LeadGuideInput = {
  status?: string | null;
  status_changed_at?: string | null;
  last_contact_at?: string | null;
  next_follow_up?: string | null;
  calls_made?: number | null;
  whatsapp_attempts?: number | null;
};

// Hitos macro del seguimiento (el pipeline de 10 etapas se mapea a estos 5 pasos).
const HITOS = ["Contacto", "Calificación", "Oferta", "Negociación", "Cierre"] as const;

const STAGE_HITO: Record<string, number> = {
  nuevo: 0,
  no_contesta: 0,
  en_seguimiento: 1,
  buscando_vehiculo: 2,
  en_espera: 2,
  negociando: 3,
  agendado: 3,
  para_cierre: 4,
  negocio_cerrado: 5, // todos completos
  cancelado: -1,
};

const SIGUIENTE_PASO: Record<string, string> = {
  nuevo: "Hacé el primer contacto: llamá y, si no contesta, mandá WhatsApp.",
  no_contesta: "Reintentá en otro horario, por llamada o WhatsApp.",
  en_seguimiento: "Confirmá qué busca y su presupuesto; calificá el interés.",
  buscando_vehiculo: "Enviá 1–2 opciones concretas del inventario que calcen.",
  en_espera: "Acordá una fecha de re-contacto y mantené el lead tibio.",
  negociando: "Cerrá precio y financiamiento; dejá todo listo para firmar.",
  agendado: "Confirmá día y hora de la cita y recordásela al cliente.",
  para_cierre: "Reuní la documentación y cerrá la nota de venta.",
  negocio_cerrado: "Venta cerrada. Hacé seguimiento post-venta.",
  cancelado: "Lead cancelado. Si reactiva, movélo a En seguimiento.",
};

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function ddmm(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function diasLabel(n: number): string {
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}

function Chip({
  icon,
  children,
  tone = "muted",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      {icon}
      {children}
    </span>
  );
}

export function LeadFollowUpGuide({ lead }: { lead: LeadGuideInput }) {
  const stageKey = getLeadCrmStageKey(lead.status) ?? "en_seguimiento";
  const hitoActual = STAGE_HITO[stageKey] ?? 1;
  const cancelado = stageKey === "cancelado";

  const diasEtapa = daysSince(lead.status_changed_at);
  const diasContacto = daysSince(lead.last_contact_at);
  const followDays = daysSince(lead.next_follow_up);
  const followOverdue = followDays !== null && followDays > 0; // next_follow_up en el pasado
  const followFuture = followDays !== null && followDays <= 0;

  const calls = Math.max(0, lead.calls_made ?? 0);
  const wapp = Math.max(0, lead.whatsapp_attempts ?? 0);
  const mostrarContactos = hitoActual >= 0 && hitoActual <= 1; // Contacto / Calificación

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-sm font-semibold">Guía de seguimiento</p>

      {/* Métricas */}
      <div className="flex flex-wrap gap-2">
        <Chip icon={<Clock className="h-3.5 w-3.5" />}>
          {CRM_PIPELINE_STATUS_LABELS[stageKey]}
          {diasEtapa !== null ? ` · ${diasLabel(diasEtapa)}` : ""}
        </Chip>
        <Chip
          icon={<Phone className="h-3.5 w-3.5" />}
          tone={diasContacto !== null && diasContacto >= 3 ? "warn" : "muted"}
        >
          {diasContacto === null ? "Sin contacto registrado" : `Último contacto ${diasLabel(diasContacto)}`}
        </Chip>
        {followOverdue ? (
          <Chip icon={<AlertTriangle className="h-3.5 w-3.5" />} tone="warn">
            Seguimiento vencido ({ddmm(lead.next_follow_up)})
          </Chip>
        ) : followFuture ? (
          <Chip icon={<CalendarClock className="h-3.5 w-3.5" />}>
            Próximo seguimiento {ddmm(lead.next_follow_up)}
          </Chip>
        ) : null}
      </div>

      {/* Paso a paso */}
      {cancelado ? (
        <p className="text-xs text-muted-foreground">{SIGUIENTE_PASO.cancelado}</p>
      ) : (
        <>
          <div className="flex items-center">
            {HITOS.map((h, i) => {
              const done = i < hitoActual;
              const current = i === hitoActual;
              return (
                <div key={h} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                        current
                          ? "bg-pink-600 text-white"
                          : done
                            ? "bg-emerald-500 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span
                      className={`text-[10px] ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {h}
                    </span>
                  </div>
                  {i < HITOS.length - 1 && (
                    <div className={`mx-1 h-0.5 flex-1 ${i < hitoActual ? "bg-emerald-500" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-md bg-background p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Próximo paso sugerido
            </p>
            <p className="text-sm mt-0.5">{SIGUIENTE_PASO[stageKey]}</p>
            {mostrarContactos && (
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Llamadas {calls}/7
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp {wapp}/7
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
