export type AppointmentEventType =
  | "test_drive"
  | "meeting"
  | "delivery"
  | "service"
  | "other"
  | "vehicle_purchase"
  | "trade_in"
  | "consignment";

export type AppointmentEventStatus = "programada" | "completada" | "cancelada";

const DB_TYPE_TO_EVENT: Record<string, AppointmentEventType> = {
  test_drive: "test_drive",
  reunion: "meeting",
  entrega: "delivery",
  servicio: "service",
  otro: "other",
  compra_vehiculo: "vehicle_purchase",
  vehiculo_en_parte: "trade_in",
  consignacion: "consignment",
};

export function safeAppointmentEventType(t: string | undefined | null): AppointmentEventType {
  return (t && DB_TYPE_TO_EVENT[t]) || "meeting";
}

export function safeAppointmentEventStatus(s: string | undefined | null): AppointmentEventStatus {
  if (s === "completada" || s === "cancelada") return s;
  return "programada";
}

export const APPOINTMENT_EVENT_TYPE_LABELS: Record<AppointmentEventType, string> = {
  test_drive: "Test Drive",
  meeting: "Reunión",
  delivery: "Entrega",
  service: "Servicio",
  other: "Otro",
  vehicle_purchase: "Compra de vehículo",
  trade_in: "Vehículo en parte",
  consignment: "Consignación",
};

export const APPOINTMENT_NO_SELLER = "__appointment_sin_vendedor__";
