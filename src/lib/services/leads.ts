import { vendorLeadScopeOrFilter } from '../leadsScope'
import { coerceCrmPipelineStatus } from '../crmPipeline'
import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Lead = Database['public']['Tables']['leads']['Row']
type LeadInsert = Database['public']['Tables']['leads']['Insert']
type LeadUpdate = Database['public']['Tables']['leads']['Update']
type LeadActivity = Database['public']['Tables']['lead_activities']['Row']
type LeadActivityInsert = Database['public']['Tables']['lead_activities']['Insert']

/** Debe coincidir con el CHECK leads_status_check en Postgres. */
const ALLOWED_LEAD_STATUSES = new Set<string>([
  'nuevo',
  'contactado',
  'interesado',
  'cotizando',
  'negociando',
  'en_espera',
  'vendido',
  'perdido',
  'para_cierre',
  'cancelado',
])

function coerceLeadStatus(status: unknown, fallback: string): string {
  const mapped = coerceCrmPipelineStatus(status, '')
  if (mapped && ALLOWED_LEAD_STATUSES.has(mapped)) return mapped
  const s = typeof status === 'string' ? status.trim().toLowerCase() : ''
  if (s && ALLOWED_LEAD_STATUSES.has(s)) return s
  return fallback
}

export const leadService = {
  // Buscar un lead por contacto (telefono/email) y sucursal
  async findByContact(params: { branchId?: string | null; phone?: string | null; email?: string | null }) {
    const { branchId, phone, email } = params
    if (!phone && !email) return null

    let query = supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    if (phone && email) {
      query = query.or(`phone.eq.${phone},email.eq.${email}`)
    } else if (phone) {
      query = query.eq('phone', phone)
    } else if (email) {
      query = query.eq('email', email)
    }

    const { data, error } = await query.limit(1)
    if (error) throw error
    return (data?.[0] as Lead) || null
  },
  // Obtener todos los leads (excluye papelera: deleted_at IS NULL)
  async getAll(filters?: {
    assignedTo?: string
    branchId?: string
    status?: string
    source?: string
    search?: string
    limit?: number
  }) {
    const isSearch = Boolean(filters?.search?.trim())
    const select = isSearch
      ? 'id, full_name, email, phone, status'
      : `
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `

    let query = supabase
      .from('leads')
      .select(select)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filters?.assignedTo) {
      query = query.or(vendorLeadScopeOrFilter(filters.assignedTo))
    }

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.source) {
      query = query.eq('source', filters.source)
    }

    if (filters?.search) {
      const s = filters.search.trim()
      query = query.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,rut.ilike.%${s}%`
      )
    }

    if (filters?.limit != null && filters.limit > 0) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Lead[]
  },

  /**
   * Leads que pueden estar buscando este vehículo: `preferred_vehicle_id`, o texto en marca/interés/preferencias.
   * No filtra por estado; la UI puede ordenar priorizando pipeline.
   */
  async listMatchingVehicle(params: {
    vehicleId: string
    make: string
    model: string
    branchId?: string
    limit?: number
  }) {
    const { vehicleId, make, model, branchId, limit = 120 } = params
    const token = (s: string) =>
      s
        .trim()
        .replace(/[%*,()]/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 100)
    const m = token(make || '')
    const mo = token(model || '')
    const parts: string[] = [`preferred_vehicle_id.eq.${vehicleId}`]
    if (m.length >= 2) {
      parts.push(`marca_preferida.ilike.%${m}%`)
      parts.push(`vehicle_interest.ilike.%${m}%`)
      parts.push(`preferencia.ilike.%${m}%`)
    }
    if (mo.length >= 2) {
      parts.push(`vehicle_interest.ilike.%${mo}%`)
      parts.push(`preferencia.ilike.%${mo}%`)
    }
    if (m.length >= 2 && mo.length >= 2) {
      const combo = token(`${m} ${mo}`)
      if (combo.length >= 4) {
        parts.push(`vehicle_interest.ilike.%${combo}%`)
      }
    }
    if (mo.length >= 4) {
      parts.push(`notes.ilike.%${mo}%`)
    }

    let query = supabase
      .from('leads')
      .select(
        `
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `
      )
      .is('deleted_at', null)
      .or(parts.join(','))
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as Lead[]
  },

  // Leads en papelera (clientes "olvidados" / no respondieron)
  // No filtramos por branch_id para que el usuario pueda ver todos los leads
  // enviados a papelera, incluso si cambiaron su sucursal.
  async getDeleted() {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) throw error
    return data as Lead[]
  },

  // Restaurar un lead desde la papelera
  async restore(id: string) {
    const { data, error } = await supabase
      .from('leads')
      .update({ deleted_at: null })
      .eq('id', id)
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Obtener un lead por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, avatar_url, crm_color),
        branch:branches(id, name, address, phone),
        activities:lead_activities(*, user:users(id, full_name))
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Crear un nuevo lead
  async create(lead: LeadInsert) {
    const row: LeadInsert = {
      ...lead,
      status: coerceLeadStatus(lead.status, 'nuevo') as LeadInsert['status'],
    }
    const { data, error } = await supabase
      .from('leads')
      .insert(row)
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Actualizar un lead
  async update(id: string, updates: LeadUpdate) {
    const payload: LeadUpdate = { ...updates }
    if (Object.prototype.hasOwnProperty.call(payload, 'status') && payload.status !== undefined) {
      payload.status = coerceLeadStatus(payload.status, 'nuevo') as LeadUpdate['status']
    }
    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, crm_color),
        branch:branches(id, name)
      `)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Eliminar un lead (soft delete: va a papelera; no se borra de la BD)
  async delete(id: string) {
    const { error } = await supabase
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  // Agregar actividad a un lead
  async addActivity(leadId: string, activity: LeadActivityInsert) {
    const { data, error } = await supabase
      .from('lead_activities')
      .insert({
        ...activity,
        lead_id: leadId
      })
      .select('*, user:users(id, full_name)')
      .single()

    if (error) throw error

    // Actualizar last_contact_at del lead
    await this.update(leadId, {
      last_contact_at: new Date().toISOString()
    })

    return data as LeadActivity
  },

  // Obtener actividades de un lead
  async getActivities(leadId: string) {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*, user:users(id, full_name, avatar_url)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as LeadActivity[]
  },

  // Obtener estadísticas de leads
  async getStats(userId?: string, branchId?: string) {
    let query = supabase
      .from('leads')
      .select('status, created_at')

    if (userId) {
      query = query.or(vendorLeadScopeOrFilter(userId))
    }

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const stats = {
      total: data.length,
      nuevo: data.filter(l => l.status === 'nuevo').length,
      contactado: data.filter(l => l.status === 'contactado').length,
      interesado: data.filter(l => l.status === 'interesado').length,
      cotizando: data.filter(l => l.status === 'cotizando').length,
      vendido: data.filter(l => l.status === 'vendido').length,
      thisMonth: data.filter(l => new Date(l.created_at) >= thisMonth).length
    }

    return stats
  },

  /** Leads nuevos recientes (popup al iniciar sesión). */
  async countRecentNewLeads(params: {
    branchId?: string | null
    assignedTo?: string | null
    hours?: number
  }): Promise<number> {
    const hours = params.hours ?? 48
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'nuevo')
      .is('deleted_at', null)
      .gte('created_at', since)

    if (params.branchId) {
      query = query.eq('branch_id', params.branchId)
    }
    if (params.assignedTo) {
      query = query.or(vendorLeadScopeOrFilter(params.assignedTo))
    }

    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  },
}


