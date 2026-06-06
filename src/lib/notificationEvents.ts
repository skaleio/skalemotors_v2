import { Car, CheckCircle, Clock, Info, UserPlus, type LucideIcon } from "lucide-react";

export type NotificationEventKey =
  | "lead_sold"
  | "vehicle_sold"
  | "vehicle_status_changed"
  | "lead_contactado"
  | "lead_assigned"
  | "lead_stale"
  | "consignacion_created"
  | "consignacion_stale"
  | "vehicle_unpublished"
  | "seller_inactive";

export type NotificationEventMeta = {
  key: NotificationEventKey;
  label: string;
  short: string;
  icon: LucideIcon;
  iconClass: string;
  description: string;
  roles: readonly (
    | "admin"
    | "vendedor"
    | "fotografo"
    | "gerente"
    | "jefe_jefe"
    | "jefe_sucursal"
    | "inventario"
    | "financiero"
    | "servicio"
  )[];
};

export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventMeta[] = [
  {
    key: "lead_sold",
    label: "Negocios cerrados",
    short: "Cerrados",
    icon: CheckCircle,
    iconClass: "text-green-500",
    description: "Cuando un lead pasa a vendido",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal"],
  },
  {
    key: "vehicle_sold",
    label: "Vehículos vendidos",
    short: "Veh. vendidos",
    icon: Car,
    iconClass: "text-emerald-600",
    description: "Vendedor marca inventario como vendido o vendido por dueño",
    roles: ["admin"],
  },
  {
    key: "vehicle_status_changed",
    label: "Estados de inventario",
    short: "Estados",
    icon: Car,
    iconClass: "text-sky-600",
    description: "Un vendedor cambia el estado de un vehículo (reservado, reparación, etc.)",
    roles: ["admin"],
  },
  {
    key: "lead_contactado",
    label: "Leads contactados",
    short: "Contactados",
    icon: Info,
    iconClass: "text-blue-500",
    description: "Vendedor marca un lead como contactado",
    roles: ["admin"],
  },
  {
    key: "lead_assigned",
    label: "Asignados a mí",
    short: "Asignados",
    icon: UserPlus,
    iconClass: "text-pink-500",
    description: "Un admin te asignó un lead",
    roles: ["vendedor"],
  },
  {
    key: "lead_stale",
    label: "Sin movimiento",
    short: "Estancados",
    icon: Clock,
    iconClass: "text-red-500",
    description: "Leads del CRM sin movimiento ni actualización > 4 días",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal", "vendedor"],
  },
  {
    key: "consignacion_created",
    label: "Consignaciones nuevas",
    short: "Nuevas",
    icon: Car,
    iconClass: "text-indigo-500",
    description: "Un vendedor registra una consignación nueva",
    roles: ["admin"],
  },
  {
    key: "consignacion_stale",
    label: "Consignación sin publicar",
    short: "Consign.",
    icon: Clock,
    iconClass: "text-amber-500",
    description: "Consignaciones en revisión > 7 días sin publicarse",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal", "inventario", "fotografo"],
  },
  {
    key: "vehicle_unpublished",
    label: "Inventario sin publicar",
    short: "Inventario",
    icon: Car,
    iconClass: "text-amber-600",
    description: "Vehículos disponibles > 5 días sin publicarse",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal", "inventario", "fotografo"],
  },
  {
    key: "seller_inactive",
    label: "Vendedor sin actividad",
    short: "Vendedores",
    icon: UserPlus,
    iconClass: "text-rose-500",
    description: "Vendedor sin uso de la plataforma ni movimiento de leads (> 24 h)",
    roles: ["admin", "jefe_sucursal"],
  },
] as const;

export function getNotificationEventMeta(type: string): NotificationEventMeta | undefined {
  return NOTIFICATION_EVENT_TYPES.find((event) => event.key === type);
}

export function notificationLabelForType(type: string): string {
  return getNotificationEventMeta(type)?.label ?? type;
}

export function notificationEventsForRole(role: string | undefined): NotificationEventMeta[] {
  if (!role) return [];
  return NOTIFICATION_EVENT_TYPES.filter((event) =>
    (event.roles as readonly string[]).includes(role),
  );
}
