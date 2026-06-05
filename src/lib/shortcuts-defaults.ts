/**
 * IDs de acciones y atajos por defecto.
 * Deben existir en `quickActions.ts` con `shortcutId` y ruta real.
 */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  new_lead: "Ctrl+L",
  crm: "Ctrl+P",
  new_sale: "Ctrl+E",
  appointments: "Ctrl+A",
  financial_calculator: "Ctrl+F",
  inventory: "Ctrl+B",
  tasacion: "Ctrl+M",
};

export type ShortcutActionId = keyof typeof DEFAULT_SHORTCUTS;

export interface ShortcutActionDef {
  id: ShortcutActionId;
  label: string;
  description: string;
  category: string;
}

export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: "new_lead", label: "Nuevo lead", description: "Registrar prospecto", category: "CRM" },
  { id: "crm", label: "CRM pipeline", description: "Abrir tablero de ventas", category: "CRM" },
  { id: "new_sale", label: "Nueva venta", description: "Registrar venta", category: "CRM" },
  { id: "appointments", label: "Citas", description: "Abrir calendario", category: "Operaciones" },
  { id: "financial_calculator", label: "Calculadora financiera", description: "Simular cuotas", category: "Operaciones" },
  { id: "tasacion", label: "Tasación", description: "Valorar por patente", category: "Operaciones" },
  { id: "inventory", label: "Agregar vehículo", description: "Nuevo stock", category: "Inventario" },
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
