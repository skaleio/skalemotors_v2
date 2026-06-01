import { supabase } from '../supabase'
import type { Database } from '../types/database'

export type TenantSite = Database['public']['Tables']['tenant_sites']['Row']
type TenantSiteInsert = Database['public']['Tables']['tenant_sites']['Insert']
type TenantSiteUpdate = Database['public']['Tables']['tenant_sites']['Update']
export type TenantDomain = Database['public']['Tables']['tenant_domains']['Row']

/**
 * Resuelve el tenant del usuario. Usa el fallback del frontend (useAuth) si está,
 * si no intenta el RPC server-side. Devuelve null si no se pudo determinar: en ese
 * caso el INSERT va sin tenant_id y el trigger BEFORE INSERT lo completa desde el perfil.
 */
async function resolveTenantId(fallback?: string): Promise<string | null> {
  if (fallback) return fallback
  try {
    const { data, error } = await supabase.rpc('current_tenant_id')
    if (error || !data) return null
    return data as unknown as string
  } catch {
    return null
  }
}

export const tenantSiteService = {
  /** Devuelve la config del sitio del tenant actual, o null si aún no existe. */
  async getMySite(): Promise<TenantSite | null> {
    const { data, error } = await supabase
      .from('tenant_sites')
      .select('*')
      .maybeSingle()
    if (error) throw error
    return data ?? null
  },

  /** Crea el sitio del tenant si no existe (idempotente vía unique tenant_id). */
  async createMySite(tenantId?: string): Promise<TenantSite> {
    const existing = await this.getMySite()
    if (existing) return existing

    const resolvedTenantId = await resolveTenantId(tenantId)
    // Si no se pudo resolver, el trigger autofill_tenant_branch_from_user completa tenant_id.
    const payload: TenantSiteInsert = resolvedTenantId
      ? { tenant_id: resolvedTenantId }
      : {}
    const { data, error } = await supabase
      .from('tenant_sites')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Actualiza la config del sitio del tenant actual. */
  async updateMySite(patch: TenantSiteUpdate): Promise<TenantSite> {
    const current = await this.getMySite()
    if (!current) {
      const created = await this.createMySite()
      const { data, error } = await supabase
        .from('tenant_sites')
        .update(patch)
        .eq('id', created.id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('tenant_sites')
      .update(patch)
      .eq('id', current.id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Lista los dominios del tenant actual. */
  async listMyDomains(): Promise<TenantDomain[]> {
    const { data, error } = await supabase
      .from('tenant_domains')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}
