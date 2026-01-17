import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Lead = Database['public']['Tables']['leads']['Row']
type LeadInsert = Database['public']['Tables']['leads']['Insert']
type LeadUpdate = Database['public']['Tables']['leads']['Update']
type LeadActivity = Database['public']['Tables']['lead_activities']['Row']
type LeadActivityInsert = Database['public']['Tables']['lead_activities']['Insert']

export const leadService = {
  // Obtener todos los leads
  async getAll(filters?: {
    assignedTo?: string
    branchId?: string
    status?: string
    source?: string
    search?: string
  }) {
    let query = supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email),
        branch:branches(id, name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
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
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query

    if (error) throw error
    return data as Lead[]
  },

  // Obtener un lead por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email, avatar_url),
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
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email),
        branch:branches(id, name)
      `)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Actualizar un lead
  async update(id: string, updates: LeadUpdate) {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email),
        branch:branches(id, name)
      `)
      .single()

    if (error) throw error
    return data as Lead
  },

  // Eliminar un lead
  async delete(id: string) {
    const { error } = await supabase
      .from('leads')
      .delete()
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
      query = query.eq('assigned_to', userId)
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
  }
}


