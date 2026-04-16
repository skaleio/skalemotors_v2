/**
 * Filtro de leads alineado con RLS:
 * - vendedor: solo leads asignados / creados por él (assigned_to en query).
 * - jefe_sucursal: sin filtro por vendedor; useLeads usa branchId = user.branch_id (toda la sucursal).
 * - admin, gerente, etc.: sin assignedTo; branchId opcional según pantalla.
 */
export function leadsAssignedToForQuery(role: string | undefined, userId: string | undefined): string | undefined {
  if (role === "vendedor" && userId) return userId;
  return undefined;
}
