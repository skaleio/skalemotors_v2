import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Appointment = Database['public']['Tables']['appointments']['Row']
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']

// Mapeo tipo frontend (inglés) -> DB (español)
const TYPE_TO_DB: Record<string, Appointment['type']> = {
  test_drive: 'test_drive',
  meeting: 'reunion',
  delivery: 'entrega',
  service: 'servicio',
  other: 'otro',
}

function toDbType(type: string): Appointment['type'] {
  return TYPE_TO_DB[type] ?? 'reunion'
}

export const appointmentService = {
  // Obtener todas las citas
  async getAll(filters?: {
    userId?: string
    branchId?: string
    leadId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }) {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(id, full_name, email, phone),
        vehicle:vehicles(id, make, model, year),
        user:users(id, full_name, email),
        branch:branches(id, name)
      `)
      .order('scheduled_at', { ascending: true })

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.dateFrom) {
      query = query.gte('scheduled_at', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('scheduled_at', filters.dateTo)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Appointment[]
  },

  // Obtener una cita por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(*),
        vehicle:vehicles(*),
        user:users(*),
        branch:branches(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Appointment
  },

  // Crear una nueva cita (acepta type en inglés y lo mapea a DB)
  async create(appointment: Omit<AppointmentInsert, 'type'> & { type?: string }) {
    const insert: AppointmentInsert = {
      ...appointment,
      type: appointment.type ? toDbType(appointment.type) : 'reunion',
      title: appointment.title ?? 'Cita',
    }
    const { data, error } = await supabase
      .from('appointments')
      .insert(insert)
      .select(`
        *,
        lead:leads(id, full_name, phone),
        vehicle:vehicles(id, make, model),
        user:users(id, full_name)
      `)
      .single()

    if (error) throw error
    return data as Appointment
  },

  // Actualizar una cita (acepta type en inglés y lo mapea a DB)
  async update(
    id: string,
    updates: Omit<AppointmentUpdate, 'type'> & { type?: string }
  ) {
    const payload: AppointmentUpdate = { ...updates }
    if (updates.type) payload.type = toDbType(updates.type)
    const { data, error } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Appointment
  },

  // Eliminar una cita
  async delete(id: string) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Obtener citas del día
  async getToday(branchId?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let query = supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(id, full_name, phone),
        vehicle:vehicles(id, make, model),
        user:users(id, full_name)
      `)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at', { ascending: true })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Appointment[]
  }
}


