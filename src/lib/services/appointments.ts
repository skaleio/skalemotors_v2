import {
  CRM_LEAD_QUICK_APPOINTMENT_DURATION_MIN,
  CRM_LEAD_QUICK_APPOINTMENT_START_HOUR,
  CRM_LEAD_QUICK_APPOINTMENT_TITLE,
} from '@/lib/crmLeadQuickAppointment'
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
  vehicle_purchase: 'compra_vehiculo',
  trade_in: 'vehiculo_en_parte',
  consignment: 'consignacion',
}

function toDbType(type: string): Appointment['type'] {
  return TYPE_TO_DB[type] ?? 'reunion'
}

export const appointmentService = {
  // Obtener todas las citas
  async getAll(filters?: {
    userId?: string
    tenantId?: string
    branchId?: string
    leadId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    /** Incluir citas archivadas (soft-delete). Por defecto se excluyen. */
    includeArchived?: boolean
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

    if (!filters?.includeArchived) {
      query = query.is('archived_at', null)
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId)
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
  },

  /**
   * Citas vencidas (scheduled_at < ahora) que el vendedor aún no resolvió
   * (status programada/confirmada) y no están archivadas. Alimentan el modal
   * bloqueante que obliga a registrar qué pasó con la cita.
   */
  async getOverdueUnresolved(userId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(id, full_name, phone),
        vehicle:vehicles(id, make, model, year)
      `)
      .eq('user_id', userId)
      .in('status', ['programada', 'confirmada'])
      .is('archived_at', null)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) throw error
    return data as Appointment[]
  },

  /**
   * Cierra una cita vencida con su resultado obligatorio. La nota queda anexada
   * a `description` para conservar el motivo original. El archivado (soft-delete)
   * de las no concretadas lo hace el cron `archive_unconcreted_appointments`.
   */
  async resolveOverdue(
    id: string,
    status: 'completada' | 'no_asistio' | 'cancelada',
    note: string,
    previousDescription?: string | null,
  ) {
    const stamped = `[Cierre] ${note.trim()}`
    const prev = previousDescription?.trim() ?? ''
    const description = (prev ? `${prev}\n\n${stamped}` : stamped).slice(0, 1000)
    await this.update(id, { status, description })
  },

  /**
   * Recordatorio desde modal CRM/Leads: crea o actualiza un evento en `appointments` ligado al lead.
   * Sin día (`dayKey` vacío): cancela el evento gestionado si existía.
   */
  async upsertCrmLeadQuickAppointment(params: {
    leadId: string
    leadDisplayName: string
    tenantId: string | null
    branchId: string | null
    userId: string | null
    existingId: string | null
    /** `yyyy-MM-dd` en calendario local, o null para quitar */
    dayKey: string | null
    /** Motivo libre: cita, volver a llamar, posible compra, etc. */
    motive?: string | null
  }) {
    const trimmedDay = params.dayKey?.trim() ?? ''

    if (!trimmedDay) {
      if (params.existingId) {
        await this.update(params.existingId, { status: 'cancelada' })
      }
      return
    }

    const parts = trimmedDay.split('-').map((x) => parseInt(x, 10))
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      throw new Error('Fecha de cita inválida')
    }
    const [y, m, d] = parts
    const start = new Date(y, m - 1, d, CRM_LEAD_QUICK_APPOINTMENT_START_HOUR, 0, 0, 0)
    const end = new Date(start.getTime() + CRM_LEAD_QUICK_APPOINTMENT_DURATION_MIN * 60 * 1000)
    const motive = params.motive?.trim() ?? ''
    const leadName = params.leadDisplayName.trim() || 'Lead'
    const description = (
      motive ||
      `Seguimiento · ${leadName}`
    ).slice(0, 500)

    const payload = {
      title: CRM_LEAD_QUICK_APPOINTMENT_TITLE,
      description,
      type: 'meeting',
      status: 'programada' as const,
      scheduled_at: start.toISOString(),
      end_at: end.toISOString(),
      duration_minutes: CRM_LEAD_QUICK_APPOINTMENT_DURATION_MIN,
      lead_id: params.leadId,
      tenant_id: params.tenantId,
      branch_id: params.branchId,
      user_id: params.userId,
    }

    if (params.existingId) {
      await this.update(params.existingId, payload)
      return
    }

    await this.create(payload)
  },
}


