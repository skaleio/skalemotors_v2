import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/supabase";

export interface BranchSeller {
  id: string;
  full_name: string;
  email: string | null;
  branch_id: string | null;
  role: string;
  crm_color?: string | null;
}

export type DelegatableSellerRole = "vendedor" | "jefe_sucursal";

export type DelegatableSellersScopeKind = "tenant" | "branch" | "my_team";

export interface DelegatableSellersScope {
  tenantId: string;
  scope: DelegatableSellersScopeKind;
  branchId?: string | null;
  /** Solo usuarios creados/invitados por este admin (rol admin / gerente). */
  teamOwnerUserId?: string;
  roles: DelegatableSellerRole[];
}

const DEFAULT_ROLES: DelegatableSellerRole[] = ["vendedor", "jefe_sucursal"];

const TENANT_WIDE_ROLES = new Set(["jefe_jefe"]);

const BRANCH_ROLES = new Set(["jefe_sucursal"]);

const TEAM_OWNER_ROLES = new Set(["admin", "gerente"]);

/**
 * Alcance de vendedores que un usuario puede elegir al delegar un lead en el CRM.
 * - Mismo tenant siempre (nunca otro automotor).
 * - jefe_jefe: todo el tenant.
 * - jefe_sucursal / financiero con sucursal: su branch.
 * - admin / gerente: solo su equipo (`users.created_by_user_id`).
 */
export function resolveDelegatableSellersScope(
  user: Pick<User, "id" | "role" | "tenant_id" | "branch_id"> | null | undefined,
  roles: DelegatableSellerRole[] = DEFAULT_ROLES,
): DelegatableSellersScope | null {
  if (!user?.tenant_id) return null;

  const role = user.role;
  if (TENANT_WIDE_ROLES.has(role)) {
    return { tenantId: user.tenant_id, scope: "tenant", roles };
  }
  if (BRANCH_ROLES.has(role) || (role === "financiero" && user.branch_id)) {
    return {
      tenantId: user.tenant_id,
      scope: "branch",
      branchId: user.branch_id,
      roles,
    };
  }
  if (TEAM_OWNER_ROLES.has(role)) {
    return {
      tenantId: user.tenant_id,
      scope: "my_team",
      teamOwnerUserId: user.id,
      roles,
    };
  }
  if (role === "financiero") {
    return { tenantId: user.tenant_id, scope: "tenant", roles };
  }
  return null;
}

/** Parámetros para `useBranchSellers` a partir del usuario autenticado. */
export function useBranchSellersOptionsFromUser(
  user: Pick<User, "id" | "role" | "tenant_id" | "branch_id"> | null | undefined,
  overrides?: { roles?: DelegatableSellerRole[]; enabled?: boolean },
) {
  const resolved = resolveDelegatableSellersScope(user, overrides?.roles);
  return {
    tenantId: resolved?.tenantId ?? null,
    branchId: resolved?.branchId ?? null,
    scope: resolved?.scope ?? "tenant",
    teamOwnerUserId: resolved?.teamOwnerUserId ?? null,
    roles: resolved?.roles ?? DEFAULT_ROLES,
    enabled: (overrides?.enabled ?? true) && !!resolved,
  } as const;
}

/** Misma lógica que el hook, para efectos async (p. ej. diálogo cerrar venta en CRM). */
export async function fetchDelegatableSellers(
  scope: DelegatableSellersScope,
): Promise<BranchSeller[]> {
  let q = supabase
    .from("users")
    .select("id, full_name, email, branch_id, role, crm_color")
    .eq("tenant_id", scope.tenantId)
    .in("role", scope.roles)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (scope.scope === "my_team" && scope.teamOwnerUserId) {
    q = q.eq("created_by_user_id", scope.teamOwnerUserId);
  } else if (scope.scope === "branch" && scope.branchId) {
    q = q.or(`branch_id.eq.${scope.branchId},branch_id.is.null`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BranchSeller[];
}
