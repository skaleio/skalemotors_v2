/** Valores permitidos en `leads.crm_seguimiento_socio` (CHECK en Postgres). */
export const CRM_SEGUIMIENTO_SOCIOS = ["Mike", "Antonio", "Jota"] as const;

export type CrmSeguimientoSocio = (typeof CRM_SEGUIMIENTO_SOCIOS)[number];

export function isCrmSeguimientoSocio(v: string | null | undefined): v is CrmSeguimientoSocio {
  return v != null && (CRM_SEGUIMIENTO_SOCIOS as readonly string[]).includes(v);
}

/** Pastilla compacta (pipeline): mismo espíritu que Finanzas (Mike azul, Jota esmeralda, Antonio sky). */
export function seguimientoSocioPillClass(name: CrmSeguimientoSocio): string {
  switch (name) {
    case "Mike":
      return "bg-blue-600 text-white shadow-sm dark:bg-blue-500";
    case "Antonio":
      return "bg-sky-600 text-white shadow-sm dark:bg-sky-500";
    case "Jota":
      return "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}
