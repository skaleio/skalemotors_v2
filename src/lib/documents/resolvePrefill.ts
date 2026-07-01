import type { Database } from "@/lib/types/database";
import type { DocumentType } from "@/lib/services/documents";
import { consignacionesService } from "@/lib/services/consignaciones";
import { vehicleService } from "@/lib/services/vehicles";
import { leadService } from "@/lib/services/leads";
import {
  emptyConsignacionForm,
  emptyReservaForm,
  mapConsignacionToForm,
  mapVehicleToConsignacionForm,
  mapVehicleToReservaForm,
  mapVehicleToVentaForm,
  type ConsignacionFormState,
  type ReservaFormState,
  type VentaFormState,
} from "@/lib/documents/mappers";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Consignacion = Awaited<ReturnType<typeof consignacionesService.resolveForVehicle>>;

export interface ConsignacionPrefillResult {
  form: ConsignacionFormState;
  consignacion: Consignacion | null;
  vehicle: Vehicle;
  warning?: string;
}

export interface VentaPrefillResult {
  form: VentaFormState;
  vehicle: Vehicle;
  warning?: string;
}

export interface ReservaPrefillResult {
  form: ReservaFormState;
  vehicle: Vehicle;
  warning?: string;
}

async function enrichOwnerFromLead(
  form: ConsignacionFormState,
  leadId: string | null | undefined
): Promise<ConsignacionFormState> {
  if (!leadId || form.owner_rut) return form;
  try {
    const lead = await leadService.getById(leadId);
    if (!lead) return form;
    return {
      ...form,
      owner_rut: lead.rut ?? form.owner_rut,
    };
  } catch {
    return form;
  }
}

export async function resolveConsignacionPrefill(
  vehicleId: string,
  branchId?: string
): Promise<ConsignacionPrefillResult> {
  const vehicle = await vehicleService.getById(vehicleId);
  const consignacion = await consignacionesService.resolveForVehicle({
    vehicleId,
    patente: vehicle.patente,
    branchId,
  });

  // Base siempre desde el vehículo (igual que la nota de venta); solo faltan
  // los datos del consignante, que el vendedor completa.
  let form: ConsignacionFormState = {
    ...emptyConsignacionForm(),
    ...mapVehicleToConsignacionForm(vehicle),
  };

  if (!consignacion) {
    if (!form.min_sale_price) form.min_sale_price = form.sale_price;
    return { form, consignacion: null, vehicle };
  }

  // Si existe un registro de consignación, sus datos tienen prioridad.
  form = { ...form, ...mapConsignacionToForm(consignacion) } as ConsignacionFormState;

  if (consignacion.motor) form.vehicle_motor = form.vehicle_motor || consignacion.motor;
  if (consignacion.vehicle_vin) {
    form.vehicle_chasis = form.vehicle_chasis || consignacion.vehicle_vin;
    form.vehicle_vin = form.vehicle_vin || consignacion.vehicle_vin;
  }

  if (consignacion.consignacion_price != null && !form.min_sale_price) {
    form.min_sale_price = String(consignacion.consignacion_price);
  }

  form = await enrichOwnerFromLead(form, consignacion.lead_id);

  return { form, consignacion, vehicle };
}

export async function resolveVentaPrefill(
  vehicleId: string,
  branchId?: string
): Promise<VentaPrefillResult> {
  const vehicle = await vehicleService.getById(vehicleId);
  const form = mapVehicleToVentaForm(vehicle) as VentaFormState;
  // El N° de motor (y a veces el N° de chasis) viven en la consignación del vehículo.
  try {
    const consignacion = await consignacionesService.resolveForVehicle({
      vehicleId,
      patente: vehicle.patente,
      branchId,
    });
    if (consignacion) {
      if (consignacion.motor && !form.vehicle_motor) form.vehicle_motor = consignacion.motor;
      if (!form.vehicle_chasis) {
        form.vehicle_chasis = consignacion.vehicle_vin ?? form.vehicle_vin ?? "";
      }
    }
  } catch {
    /* la nota de venta no depende de la consignación */
  }
  return { form, vehicle };
}

export async function resolveReservaPrefill(
  vehicleId: string,
  branchId?: string
): Promise<ReservaPrefillResult> {
  const vehicle = await vehicleService.getById(vehicleId);
  const form = { ...emptyReservaForm(), ...mapVehicleToReservaForm(vehicle) } as ReservaFormState;
  // El N° de motor (y a veces el N° de chasis) viven en la consignación del vehículo.
  try {
    const consignacion = await consignacionesService.resolveForVehicle({
      vehicleId,
      patente: vehicle.patente,
      branchId,
    });
    if (consignacion) {
      if (consignacion.motor && !form.vehicle_motor) form.vehicle_motor = consignacion.motor;
      if (!form.vehicle_chasis) {
        form.vehicle_chasis = consignacion.vehicle_vin ?? form.vehicle_vin ?? "";
      }
    }
  } catch {
    /* la nota de reserva no depende de la consignación */
  }
  return { form, vehicle };
}

export function consignacionFormToDocumentFields(
  form: ConsignacionFormState,
  extras?: { min_sale_price?: number | null; vehicle_motor?: string; vehicle_chasis?: string }
) {
  const price = parseFloat(form.sale_price) || 0;
  const pct = parseFloat(form.commission_percentage) || 0;
  return {
    vehicle_id: form.vehicle_id || null,
    vehicle_make: form.vehicle_make || null,
    vehicle_model: form.vehicle_model || null,
    vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
    vehicle_vin: form.vehicle_vin || null,
    vehicle_patente: form.vehicle_patente?.toUpperCase() || null,
    vehicle_km: form.vehicle_km ? parseInt(form.vehicle_km, 10) : null,
    vehicle_color: form.vehicle_color || null,
    vehicle_motor: extras?.vehicle_motor ?? null,
    vehicle_chasis: extras?.vehicle_chasis ?? (form.vehicle_vin || null),
    owner_name: form.owner_name || null,
    owner_rut: form.owner_rut || null,
    owner_phone: form.owner_phone || null,
    owner_email: form.owner_email || null,
    owner_address: form.owner_address || null,
    sale_price: price || null,
    min_sale_price: extras?.min_sale_price ?? (price || null),
    commission_percentage: pct || null,
    commission_amount: Math.round((price * pct) / 100) || null,
    notes: form.notes || null,
    lead_id: form.lead_id || null,
    consignacion_id: form.consignacion_id || null,
  };
}

export function documentTypeFromQuery(raw: string | null): DocumentType {
  if (raw === "venta") return "contrato_venta";
  if (raw === "reserva") return "nota_reserva";
  return "contrato_consignacion";
}
