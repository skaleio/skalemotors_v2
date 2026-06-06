/**
 * Visibilidad de leads alineada con RLS y el pool de delegación CEO.
 *
 * - vendedor: solo leads asignados a él, o propios aún sin `assigned_to`.
 * - admin / jefe_jefe (CEO): ven todo el tenant; pool sin asignar queda en Vista CEO.
 * - jefe_sucursal, gerente, etc.: sin filtro por vendedor en query (sucursal / tenant).
 */

type LeadVendorScopeFields = {
  assigned_to?: string | null;
  created_by?: string | null;
};

/** PostgREST `.or()` para restringir queries al scope de un vendedor. */
export function vendorLeadScopeOrFilter(vendorUserId: string): string {
  return `assigned_to.eq.${vendorUserId},and(created_by.eq.${vendorUserId},assigned_to.is.null)`;
}

/** Lead visible en CRM/Leads del vendedor (asignado o creado por él sin delegar). */
export function isLeadVisibleToVendor(lead: LeadVendorScopeFields, vendorUserId: string): boolean {
  if (!vendorUserId) return false;
  const assignedTo = lead.assigned_to?.trim() || null;
  if (assignedTo === vendorUserId) return true;
  if (!assignedTo && lead.created_by === vendorUserId) return true;
  return false;
}

export function filterLeadsForVendorView<T extends LeadVendorScopeFields>(
  leads: readonly T[],
  vendorUserId: string,
): T[] {
  if (!vendorUserId) return [];
  return leads.filter((lead) => isLeadVisibleToVendor(lead, vendorUserId));
}

/**
 * Lead en pool CEO: sin vendedor asignado (p. ej. creado por admin en NUEVO).
 * Los vendedores no deben verlo hasta que se delegue con `assigned_to`.
 */
export function isLeadInCeoDelegationPool(lead: LeadVendorScopeFields): boolean {
  return !lead.assigned_to?.trim();
}

export function leadsAssignedToForQuery(role: string | undefined, userId: string | undefined): string | undefined {
  if (role === "vendedor" && userId) return userId;
  return undefined;
}

export function shouldApplyVendorLeadScope(role: string | undefined): boolean {
  return role === "vendedor";
}
