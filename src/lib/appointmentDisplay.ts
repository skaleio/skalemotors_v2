import { addMinutes } from "date-fns";

export const appointmentTypeLabels: Record<string, string> = {
  test_drive: "Test Drive",
  reunion: "Reunión",
  entrega: "Entrega",
  servicio: "Servicio",
  otro: "Otro",
  compra_vehiculo: "Compra de vehículo",
  vehiculo_en_parte: "Vehículo en parte",
  consignacion: "Consignación",
};

export const appointmentStatusLabels: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

type AppointmentLead = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
} | null;

type AppointmentVehicle = {
  make: string;
  model: string;
  year?: number | null;
} | null;

type AppointmentUser = {
  full_name?: string | null;
  email?: string | null;
} | null;

type AppointmentBranch = {
  name: string;
} | null;

export type AppointmentListItem = {
  id: string;
  title?: string | null;
  type: string;
  status: string;
  scheduled_at: string;
  end_at?: string | null;
  duration_minutes?: number | null;
  description?: string | null;
  notes?: string | null;
  location?: string | null;
  lead?: AppointmentLead;
  vehicle?: AppointmentVehicle;
  user?: AppointmentUser;
  branch?: AppointmentBranch;
};

export type AppointmentDetailSnapshot = {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  scheduledAt: string;
  endAt: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  vehicleStr: string;
  branchName: string;
  assigneeName: string | null;
  location: string | null;
  notes: string | null;
};

export function buildAppointmentDetailSnapshot(apt: AppointmentListItem): AppointmentDetailSnapshot {
  const scheduledAt = new Date(apt.scheduled_at);
  const endAt = apt.end_at
    ? new Date(apt.end_at)
    : addMinutes(scheduledAt, apt.duration_minutes ?? 60);

  const lead = apt.lead;
  const vehicle = apt.vehicle;
  const branch = apt.branch;
  const assignee = apt.user;

  const typeLabel = appointmentTypeLabels[apt.type] ?? apt.type;
  const statusLabel = appointmentStatusLabels[apt.status] ?? apt.status;
  const clientName = lead?.full_name?.trim() || "Sin nombre";
  const vehicleStr = vehicle
    ? `${vehicle.make} ${vehicle.model} ${vehicle.year ?? ""}`.trim()
    : "—";
  const notes = (apt.description ?? apt.notes ?? "").trim() || null;

  return {
    id: apt.id,
    title: apt.title?.trim() || typeLabel,
    typeLabel,
    status: apt.status,
    statusLabel,
    scheduledAt: apt.scheduled_at,
    endAt: endAt.toISOString(),
    clientName,
    clientPhone: lead?.phone?.trim() || null,
    clientEmail: lead?.email?.trim() || null,
    vehicleStr,
    branchName: branch?.name ?? "—",
    assigneeName: assignee?.full_name?.trim() || assignee?.email?.trim() || null,
    location: apt.location?.trim() || null,
    notes,
  };
}
