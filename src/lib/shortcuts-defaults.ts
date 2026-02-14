/**
 * IDs de acciones y atajos por defecto.
 * Las claves deben coincidir con los actionId usados en useGlobalShortcuts.
 */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  new_lead: "Ctrl+L",
  crm: "Ctrl+P",
  quotes: "Ctrl+Q",
  new_sale: "Ctrl+E",
  appointments: "Ctrl+A",
  financial_calculator: "Ctrl+F",
  inventory: "Ctrl+V",
  consignaciones: "Ctrl+C",
  billing: "Ctrl+I",
};

export type ShortcutActionId = keyof typeof DEFAULT_SHORTCUTS;

export interface ShortcutActionDef {
  id: ShortcutActionId;
  label: string;
  description: string;
  category: string;
}

export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: "new_lead", label: "Nuevo Lead", description: "Agregar prospecto", category: "CRM" },
  { id: "crm", label: "CRM Pipeline", description: "Gestionar ventas", category: "CRM" },
  { id: "quotes", label: "Nueva Cotización", description: "Crear propuesta", category: "CRM" },
  { id: "new_sale", label: "Nueva Venta", description: "Registrar venta", category: "CRM" },
  { id: "appointments", label: "Nueva Cita", description: "Programar reunión", category: "Operaciones" },
  { id: "financial_calculator", label: "Financiamiento", description: "Calcular cuotas", category: "Operaciones" },
  { id: "inventory", label: "Agregar Vehículo", description: "Nuevo stock", category: "Inventario" },
  { id: "consignaciones", label: "Agregar Consignación", description: "Nueva consignación", category: "Inventario" },
  { id: "billing", label: "Nueva Factura", description: "Emitir documento", category: "Finanzas" },
];

/** Formato normalizado para comparar: siempre "Ctrl+..." (Ctrl y Cmd se tratan igual). */
export function formatKeyCombo(ctrl: boolean, meta: boolean, key: string): string {
  if (!ctrl && !meta) return key.length === 1 ? key.toUpperCase() : key;
  const k = key.length === 1 ? key.toUpperCase() : key;
  return "Ctrl+" + k;
}

export function parseKeyCombo(combo: string): { ctrl: boolean; meta: boolean; key: string } {
  const upper = combo.toUpperCase();
  const ctrl = upper.includes("CTRL");
  const meta = upper.includes("CMD");
  const parts = combo.split("+").map((p) => p.trim());
  const keyPart = parts.filter((p) => !/^(CTRL|CMD)$/i.test(p))[0] || "";
  const key = keyPart.length === 1 ? keyPart.toLowerCase() : keyPart;
  return { ctrl, meta, key };
}
