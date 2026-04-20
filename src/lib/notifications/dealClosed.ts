import type { Database } from "@/lib/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type DealClosedPayload = {
  lead_id: string;
  cliente: {
    nombre: string | null;
    telefono: string | null;
    email: string | null;
  };
  status_anterior: string | null;
  status_actual: "vendido";
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  closed_by_staff_id: string | null;
  vehiculo: string | null;
  branch_id: string | null;
  tenant_id: string | null;
  forma_pago: string | null;
  precio_venta: number | null;
  origen: string | null;
  tags: unknown;
  notas: string | null;
  fecha_iso: string;
  actor_user_id: string | null;
};

export type NotifyDealClosedInput = {
  lead: Lead;
  previousStatus: string | null;
  vehicleLabel?: string | null;
  actorUserId?: string | null;
  salePrice?: number | null;
  sellerName?: string | null;
};

export function notifyDealClosed({
  lead,
  previousStatus,
  vehicleLabel = null,
  actorUserId = null,
  salePrice = null,
  sellerName = null,
}: NotifyDealClosedInput): void {
  const url = import.meta.env.VITE_N8N_WEBHOOK_DEAL_CLOSED;
  if (!url) return;

  const payload: DealClosedPayload = {
    lead_id: lead.id,
    cliente: {
      nombre: lead.full_name ?? null,
      telefono: lead.phone ?? null,
      email: lead.email ?? null,
    },
    status_anterior: previousStatus,
    status_actual: "vendido",
    vendedor_id: lead.assigned_to ?? null,
    vendedor_nombre: sellerName,
    closed_by_staff_id: lead.closed_by_staff_id ?? null,
    vehiculo: vehicleLabel,
    branch_id: lead.branch_id ?? null,
    tenant_id: lead.tenant_id ?? null,
    forma_pago: lead.payment_type ?? null,
    precio_venta: salePrice,
    origen: lead.source ?? null,
    tags: lead.tags ?? null,
    notas: lead.notes ?? null,
    fecha_iso: new Date().toISOString(),
    actor_user_id: actorUserId,
  };

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => {
    console.warn("[notifyDealClosed] webhook falló", err);
  });
}
