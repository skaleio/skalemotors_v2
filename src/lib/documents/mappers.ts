import type { Database } from "@/lib/types/database";
import type { Document } from "@/lib/services/documents";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Consignacion = Database["public"]["Tables"]["consignaciones"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];

export type VentaFormState = {
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_vin: string;
  vehicle_patente: string;
  vehicle_km: string;
  vehicle_color: string;
  vehicle_motor: string;
  vehicle_chasis: string;
  buyer_name: string;
  buyer_rut: string;
  buyer_phone: string;
  buyer_email: string;
  buyer_address: string;
  sale_price: string;
  down_payment: string;
  payment_method: string;
  notes: string;
  lead_id: string;
  sale_id: string;
  consignacion_id: string;
};

export type ConsignacionFormState = {
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_vin: string;
  vehicle_patente: string;
  vehicle_km: string;
  vehicle_color: string;
  vehicle_motor: string;
  vehicle_chasis: string;
  owner_name: string;
  owner_rut: string;
  owner_phone: string;
  owner_email: string;
  owner_address: string;
  sale_price: string;
  min_sale_price: string;
  commission_percentage: string;
  notes: string;
  lead_id: string;
  consignacion_id: string;
};

export const emptyVentaForm = (): VentaFormState => ({
  vehicle_id: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_year: "",
  vehicle_vin: "",
  vehicle_patente: "",
  vehicle_km: "",
  vehicle_color: "",
  vehicle_motor: "",
  vehicle_chasis: "",
  buyer_name: "",
  buyer_rut: "",
  buyer_phone: "",
  buyer_email: "",
  buyer_address: "",
  sale_price: "",
  down_payment: "",
  payment_method: "efectivo",
  notes: "",
  lead_id: "",
  sale_id: "",
  consignacion_id: "",
});

export const emptyConsignacionForm = (): ConsignacionFormState => ({
  vehicle_id: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_year: "",
  vehicle_vin: "",
  vehicle_patente: "",
  vehicle_km: "",
  vehicle_color: "",
  vehicle_motor: "",
  vehicle_chasis: "",
  owner_name: "",
  owner_rut: "",
  owner_phone: "",
  owner_email: "",
  owner_address: "",
  sale_price: "",
  min_sale_price: "",
  commission_percentage: "5",
  notes: "",
  lead_id: "",
  consignacion_id: "",
});

export function mapVehicleToVentaForm(v: Vehicle): Partial<VentaFormState> {
  return {
    vehicle_id: v.id,
    vehicle_make: v.make ?? "",
    vehicle_model: v.model ?? "",
    vehicle_year: v.year != null ? String(v.year) : "",
    vehicle_vin: v.vin ?? "",
    vehicle_patente: (v.patente ?? "").toUpperCase(),
    vehicle_km: v.mileage != null ? String(v.mileage) : "",
    vehicle_color: v.color ?? "",
    vehicle_chasis: v.vin ?? "",
    sale_price: v.price != null ? String(v.price) : "",
  };
}

export function mapVehicleToConsignacionForm(v: Vehicle): Partial<ConsignacionFormState> {
  return {
    vehicle_id: v.id,
    vehicle_make: v.make ?? "",
    vehicle_model: v.model ?? "",
    vehicle_year: v.year != null ? String(v.year) : "",
    vehicle_vin: v.vin ?? "",
    vehicle_patente: (v.patente ?? "").toUpperCase(),
    vehicle_km: v.mileage != null ? String(v.mileage) : "",
    vehicle_color: v.color ?? "",
    vehicle_motor: v.engine_number ?? "",
    vehicle_chasis: v.vin ?? "",
    sale_price: v.price != null ? String(v.price) : "",
    owner_name: v.owner_name ?? "",
    owner_phone: v.owner_phone ?? "",
  };
}

export function mapConsignacionToForm(c: Consignacion): Partial<ConsignacionFormState> {
  const suggested = c.sale_price ?? c.consignacion_price;
  const minimum = c.consignacion_price ?? c.sale_price;
  // Solo campos con valor: el resultado se hace spread sobre los datos del
  // vehículo y un null de la consignación no debe borrarlos.
  // vehicle_motor es el N° de motor (engine_number); c.motor es la cilindrada.
  const candidate: Partial<ConsignacionFormState> = {
    consignacion_id: c.id,
    vehicle_id: c.vehicle_id,
    vehicle_make: c.vehicle_make,
    vehicle_model: c.vehicle_model,
    vehicle_year: c.vehicle_year != null ? String(c.vehicle_year) : null,
    vehicle_vin: c.vehicle_vin,
    vehicle_patente: c.patente ? c.patente.toUpperCase() : null,
    vehicle_km: c.vehicle_km != null ? String(c.vehicle_km) : null,
    vehicle_color: c.color,
    vehicle_motor: c.engine_number,
    vehicle_chasis: c.vehicle_vin,
    owner_name: c.owner_name,
    owner_phone: c.owner_phone,
    owner_email: c.owner_email,
    sale_price: suggested != null ? String(suggested) : null,
    min_sale_price: minimum != null ? String(minimum) : null,
    notes: c.notes,
    lead_id: c.lead_id,
  };
  return Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value != null && value !== "")
  ) as Partial<ConsignacionFormState>;
}

export function mapLeadToBuyer(lead: Lead): Partial<VentaFormState> {
  return {
    lead_id: lead.id,
    buyer_name: lead.full_name ?? "",
    buyer_phone: lead.phone ?? "",
    buyer_email: lead.email ?? "",
    buyer_rut: lead.rut ?? "",
  };
}

export function documentToVentaForm(doc: Document): VentaFormState {
  return {
    vehicle_id: doc.vehicle_id ?? "",
    vehicle_make: doc.vehicle_make ?? "",
    vehicle_model: doc.vehicle_model ?? "",
    vehicle_year: doc.vehicle_year != null ? String(doc.vehicle_year) : "",
    vehicle_vin: doc.vehicle_vin ?? "",
    vehicle_patente: doc.vehicle_patente ?? "",
    vehicle_km: doc.vehicle_km != null ? String(doc.vehicle_km) : "",
    vehicle_color: doc.vehicle_color ?? "",
    vehicle_motor: doc.vehicle_motor ?? "",
    vehicle_chasis: doc.vehicle_chasis ?? doc.vehicle_vin ?? "",
    buyer_name: doc.buyer_name ?? "",
    buyer_rut: doc.buyer_rut ?? "",
    buyer_phone: doc.buyer_phone ?? "",
    buyer_email: doc.buyer_email ?? "",
    buyer_address: doc.buyer_address ?? "",
    sale_price: doc.sale_price != null ? String(doc.sale_price) : "",
    down_payment: doc.down_payment != null ? String(doc.down_payment) : "",
    payment_method: doc.payment_method ?? "efectivo",
    notes: doc.notes ?? "",
    lead_id: doc.lead_id ?? "",
    sale_id: doc.sale_id ?? "",
    consignacion_id: doc.consignacion_id ?? "",
  };
}

export function documentToConsignacionForm(doc: Document): ConsignacionFormState {
  return {
    vehicle_id: doc.vehicle_id ?? "",
    vehicle_make: doc.vehicle_make ?? "",
    vehicle_model: doc.vehicle_model ?? "",
    vehicle_year: doc.vehicle_year != null ? String(doc.vehicle_year) : "",
    vehicle_vin: doc.vehicle_vin ?? "",
    vehicle_patente: doc.vehicle_patente ?? "",
    vehicle_km: doc.vehicle_km != null ? String(doc.vehicle_km) : "",
    vehicle_color: doc.vehicle_color ?? "",
    vehicle_motor: doc.vehicle_motor ?? "",
    vehicle_chasis: doc.vehicle_chasis ?? doc.vehicle_vin ?? "",
    owner_name: doc.owner_name ?? "",
    owner_rut: doc.owner_rut ?? "",
    owner_phone: doc.owner_phone ?? "",
    owner_email: doc.owner_email ?? "",
    owner_address: doc.owner_address ?? "",
    sale_price: doc.sale_price != null ? String(doc.sale_price) : "",
    min_sale_price:
      doc.min_sale_price != null
        ? String(doc.min_sale_price)
        : doc.sale_price != null
          ? String(doc.sale_price)
          : "",
    commission_percentage:
      doc.commission_percentage != null ? String(doc.commission_percentage) : "5",
    notes: doc.notes ?? "",
    lead_id: doc.lead_id ?? "",
    consignacion_id: doc.consignacion_id ?? "",
  };
}

/** Objeto tipo Document para vista previa en vivo (sin persistir). */
export function ventaFormToPreview(
  form: VentaFormState,
  opts?: { document_number?: string; issuerName?: string }
): Document {
  const now = new Date().toISOString();
  return {
    id: "preview",
    branch_id: null,
    tenant_id: null,
    created_by: null,
    type: "contrato_venta",
    document_number: opts?.document_number ?? "BORRADOR",
    status: "borrador",
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    owner_name: null,
    owner_rut: null,
    owner_phone: null,
    owner_email: null,
    owner_address: null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: form.down_payment ? parseFloat(form.down_payment) : null,
    commission_percentage: null,
    commission_amount: null,
    payment_method: form.payment_method || null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
    lead_id: form.lead_id || null,
    notes: form.notes || null,
    created_at: now,
    updated_at: now,
  };
}

export function consignacionFormToPreview(
  form: ConsignacionFormState,
  opts?: { document_number?: string }
): Document {
  const price = parseFloat(form.sale_price) || 0;
  const pct = parseFloat(form.commission_percentage) || 0;
  const amount = Math.round((price * pct) / 100);
  const now = new Date().toISOString();
  return {
    id: "preview",
    branch_id: null,
    tenant_id: null,
    created_by: null,
    type: "contrato_consignacion",
    document_number: opts?.document_number ?? "BORRADOR",
    status: "borrador",
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || null,
    buyer_name: null,
    buyer_rut: null,
    buyer_phone: null,
    buyer_email: null,
    buyer_address: null,
    owner_name: form.owner_name || null,
    owner_rut: form.owner_rut || null,
    owner_phone: form.owner_phone || null,
    owner_email: form.owner_email ?? null,
    owner_address: form.owner_address || null,
    sale_price: price || null,
    min_sale_price: parseFloat(form.min_sale_price) || price || null,
    commission_percentage: pct || null,
    commission_amount: amount || null,
    payment_method: null,
    sale_id: null,
    consignacion_id: form.consignacion_id || null,
    lead_id: form.lead_id || null,
    notes: form.notes || null,
    created_at: now,
    updated_at: now,
  };
}

export function ventaFormToInsert(
  form: VentaFormState,
  ctx: { branch_id: string | null; tenant_id: string | null; created_by: string | null; status: Document["status"] }
): Omit<import("@/lib/services/documents").DocumentInsert, "document_number"> & {
  branch_id?: string | null;
} {
  return {
    type: "contrato_venta",
    branch_id: ctx.branch_id,
    tenant_id: ctx.tenant_id,
    created_by: ctx.created_by,
    status: ctx.status,
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: form.down_payment ? parseFloat(form.down_payment) : null,
    payment_method: form.payment_method || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

export function consignacionFormToInsert(
  form: ConsignacionFormState,
  ctx: { branch_id: string | null; tenant_id: string | null; created_by: string | null; status: Document["status"] }
): Omit<import("@/lib/services/documents").DocumentInsert, "document_number"> & {
  branch_id?: string | null;
} {
  const price = parseFloat(form.sale_price) || 0;
  const minPrice = parseFloat(form.min_sale_price) || price;
  const pct = parseFloat(form.commission_percentage) || 0;
  const amount = Math.round((price * pct) / 100);
  return {
    type: "contrato_consignacion",
    branch_id: ctx.branch_id,
    tenant_id: ctx.tenant_id,
    created_by: ctx.created_by,
    status: ctx.status,
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || null,
    owner_name: form.owner_name || null,
    owner_rut: form.owner_rut || null,
    owner_phone: form.owner_phone || null,
    owner_email: form.owner_email || null,
    owner_address: form.owner_address || null,
    sale_price: price || null,
    min_sale_price: minPrice || null,
    commission_percentage: pct || null,
    commission_amount: amount || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

export function ventaFormToUpdate(form: VentaFormState): import("@/lib/services/documents").DocumentUpdate {
  return {
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: form.down_payment ? parseFloat(form.down_payment) : null,
    payment_method: form.payment_method || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

/** Monto reservado fijo de la nota de reserva (Miami Motors). */
export const RESERVED_AMOUNT = 200000;

function defaultReservaExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export type ReservaFormState = {
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_vin: string;
  vehicle_patente: string;
  vehicle_km: string;
  vehicle_color: string;
  vehicle_motor: string;
  vehicle_chasis: string;
  buyer_name: string;
  buyer_rut: string;
  buyer_phone: string;
  buyer_email: string;
  buyer_address: string;
  sale_price: string;
  reservation_expires_at: string;
  notes: string;
  lead_id: string;
  sale_id: string;
  consignacion_id: string;
};

export const emptyReservaForm = (): ReservaFormState => ({
  vehicle_id: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_year: "",
  vehicle_vin: "",
  vehicle_patente: "",
  vehicle_km: "",
  vehicle_color: "",
  vehicle_motor: "",
  vehicle_chasis: "",
  buyer_name: "",
  buyer_rut: "",
  buyer_phone: "",
  buyer_email: "",
  buyer_address: "",
  sale_price: "",
  reservation_expires_at: defaultReservaExpiry(),
  notes: "",
  lead_id: "",
  sale_id: "",
  consignacion_id: "",
});

export function mapVehicleToReservaForm(v: Vehicle): Partial<ReservaFormState> {
  return {
    vehicle_id: v.id,
    vehicle_make: v.make ?? "",
    vehicle_model: v.model ?? "",
    vehicle_year: v.year != null ? String(v.year) : "",
    vehicle_vin: v.vin ?? "",
    vehicle_patente: (v.patente ?? "").toUpperCase(),
    vehicle_km: v.mileage != null ? String(v.mileage) : "",
    vehicle_color: v.color ?? "",
    vehicle_motor: v.engine_number ?? "",
    vehicle_chasis: v.vin ?? "",
    sale_price: v.price != null ? String(v.price) : "",
  };
}

export function documentToReservaForm(doc: Document): ReservaFormState {
  return {
    vehicle_id: doc.vehicle_id ?? "",
    vehicle_make: doc.vehicle_make ?? "",
    vehicle_model: doc.vehicle_model ?? "",
    vehicle_year: doc.vehicle_year != null ? String(doc.vehicle_year) : "",
    vehicle_vin: doc.vehicle_vin ?? "",
    vehicle_patente: doc.vehicle_patente ?? "",
    vehicle_km: doc.vehicle_km != null ? String(doc.vehicle_km) : "",
    vehicle_color: doc.vehicle_color ?? "",
    vehicle_motor: doc.vehicle_motor ?? "",
    vehicle_chasis: doc.vehicle_chasis ?? doc.vehicle_vin ?? "",
    buyer_name: doc.buyer_name ?? "",
    buyer_rut: doc.buyer_rut ?? "",
    buyer_phone: doc.buyer_phone ?? "",
    buyer_email: doc.buyer_email ?? "",
    buyer_address: doc.buyer_address ?? "",
    sale_price: doc.sale_price != null ? String(doc.sale_price) : "",
    reservation_expires_at: doc.reservation_expires_at ?? defaultReservaExpiry(),
    notes: doc.notes ?? "",
    lead_id: doc.lead_id ?? "",
    sale_id: doc.sale_id ?? "",
    consignacion_id: doc.consignacion_id ?? "",
  };
}

export function reservaFormToPreview(
  form: ReservaFormState,
  opts?: { document_number?: string }
): Document {
  const now = new Date().toISOString();
  return {
    id: "preview",
    branch_id: null,
    tenant_id: null,
    created_by: null,
    type: "nota_reserva",
    document_number: opts?.document_number ?? "BORRADOR",
    status: "borrador",
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    owner_name: null,
    owner_rut: null,
    owner_phone: null,
    owner_email: null,
    owner_address: null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: RESERVED_AMOUNT,
    reservation_expires_at: form.reservation_expires_at || null,
    commission_percentage: null,
    commission_amount: null,
    payment_method: null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
    lead_id: form.lead_id || null,
    notes: form.notes || null,
    created_at: now,
    updated_at: now,
  };
}

export function reservaFormToInsert(
  form: ReservaFormState,
  ctx: { branch_id: string | null; tenant_id: string | null; created_by: string | null; status: Document["status"] }
): Omit<import("@/lib/services/documents").DocumentInsert, "document_number"> & {
  branch_id?: string | null;
} {
  return {
    type: "nota_reserva",
    branch_id: ctx.branch_id,
    tenant_id: ctx.tenant_id,
    created_by: ctx.created_by,
    status: ctx.status,
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: RESERVED_AMOUNT,
    reservation_expires_at: form.reservation_expires_at || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

export function reservaFormToUpdate(
  form: ReservaFormState
): import("@/lib/services/documents").DocumentUpdate {
  return {
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || form.vehicle_vin || null,
    buyer_name: form.buyer_name || null,
    buyer_rut: form.buyer_rut || null,
    buyer_phone: form.buyer_phone || null,
    buyer_email: form.buyer_email || null,
    buyer_address: form.buyer_address || null,
    sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
    down_payment: RESERVED_AMOUNT,
    reservation_expires_at: form.reservation_expires_at || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    sale_id: form.sale_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

export function consignacionFormToUpdate(
  form: ConsignacionFormState
): import("@/lib/services/documents").DocumentUpdate {
  const price = parseFloat(form.sale_price) || 0;
  const minPrice = parseFloat(form.min_sale_price) || price;
  const pct = parseFloat(form.commission_percentage) || 0;
  const amount = Math.round((price * pct) / 100);
  return {
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: form.vehicle_motor || null,
    vehicle_chasis: form.vehicle_chasis || null,
    owner_name: form.owner_name || null,
    owner_rut: form.owner_rut || null,
    owner_phone: form.owner_phone || null,
    owner_email: form.owner_email || null,
    owner_address: form.owner_address || null,
    sale_price: price || null,
    min_sale_price: minPrice || null,
    commission_percentage: pct || null,
    commission_amount: amount || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}
