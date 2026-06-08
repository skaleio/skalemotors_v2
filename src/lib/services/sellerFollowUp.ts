import { supabase } from '../supabase'
import type { Database } from '../types/database'

export type SellerFollowUpPeriod = 'am' | 'pm'

type SellerFollowUpCheck = Database['public']['Tables']['seller_follow_up_checks']['Row']
type SellerFollowUpCheckInsert = Database['public']['Tables']['seller_follow_up_checks']['Insert']
type SellerFollowUpNote = Database['public']['Tables']['seller_follow_up_notes']['Row']

export type SellerFollowUpCheckRow = SellerFollowUpCheck
export type SellerFollowUpNoteRow = SellerFollowUpNote

type SupabaseErrorLike = { message?: string; code?: string; details?: string; hint?: string }

export function formatSellerFollowUpError(error: SupabaseErrorLike): Error {
  const message = error.message ?? 'Error al guardar seguimiento'
  const code = error.code ?? ''

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('seller_follow_up_checks') ||
    message.includes('seller_follow_up_notes') ||
    message.includes('schema cache')
  ) {
    return new Error(
      'Falta aplicar las migraciones de seguimiento en Supabase (seller_follow_up_checks / seller_follow_up_notes).',
    )
  }

  if (code === '42501' || message.toLowerCase().includes('row-level security')) {
    return new Error('Sin permiso para guardar. Se requiere rol admin o jefe_jefe.')
  }

  return new Error(message)
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const sellerFollowUpService = {
  async listForDateRange(params: {
    fromDate: string
    toDate: string
  }): Promise<SellerFollowUpCheckRow[]> {
    const { fromDate, toDate } = params
    const { data, error } = await supabase
      .from('seller_follow_up_checks')
      .select('*')
      .gte('follow_up_date', fromDate)
      .lte('follow_up_date', toDate)
      .order('follow_up_date', { ascending: true })

    if (error) throw formatSellerFollowUpError(error)
    return (data ?? []) as SellerFollowUpCheckRow[]
  },

  async listNotesForDateRange(params: {
    fromDate: string
    toDate: string
  }): Promise<SellerFollowUpNoteRow[]> {
    const { fromDate, toDate } = params
    const { data, error } = await supabase
      .from('seller_follow_up_notes')
      .select('*')
      .gte('follow_up_date', fromDate)
      .lte('follow_up_date', toDate)
      .order('follow_up_date', { ascending: true })

    if (error) throw formatSellerFollowUpError(error)
    return (data ?? []) as SellerFollowUpNoteRow[]
  },

  async setChecked(params: {
    tenantId: string
    branchId?: string | null
    followUpDate: Date | string
    sellerUserId: string
    period: SellerFollowUpPeriod
    checked: boolean
    checkedByUserId: string
  }): Promise<SellerFollowUpCheckRow> {
    const followUpDate =
      typeof params.followUpDate === 'string'
        ? params.followUpDate
        : formatDateKey(params.followUpDate)

    const now = new Date().toISOString()
    const patch = {
      checked: params.checked,
      checked_by: params.checked ? params.checkedByUserId : null,
      checked_at: params.checked ? now : null,
      updated_at: now,
    }

    const { data: updated, error: updateError } = await supabase
      .from('seller_follow_up_checks')
      .update(patch)
      .eq('follow_up_date', followUpDate)
      .eq('seller_user_id', params.sellerUserId)
      .eq('period', params.period)
      .select('*')
      .maybeSingle()

    if (updateError) throw formatSellerFollowUpError(updateError)
    if (updated) return updated as SellerFollowUpCheckRow

    const insertPayload: SellerFollowUpCheckInsert = {
      tenant_id: params.tenantId,
      branch_id: params.branchId ?? null,
      follow_up_date: followUpDate,
      seller_user_id: params.sellerUserId,
      period: params.period,
      ...patch,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('seller_follow_up_checks')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) throw formatSellerFollowUpError(insertError)
    return inserted as SellerFollowUpCheckRow
  },

  async saveNote(params: {
    tenantId: string
    branchId?: string | null
    followUpDate: string
    sellerUserId: string
    note: string
    updatedByUserId: string
  }): Promise<SellerFollowUpNoteRow | null> {
    const now = new Date().toISOString()
    const trimmed = params.note.trim()

    const { data: updated, error: updateError } = await supabase
      .from('seller_follow_up_notes')
      .update({
        note: trimmed,
        updated_by: params.updatedByUserId,
        updated_at: now,
      })
      .eq('follow_up_date', params.followUpDate)
      .eq('seller_user_id', params.sellerUserId)
      .select('*')
      .maybeSingle()

    if (updateError) throw formatSellerFollowUpError(updateError)
    if (updated) return updated as SellerFollowUpNoteRow
    if (!trimmed) return null

    const { data: inserted, error: insertError } = await supabase
      .from('seller_follow_up_notes')
      .insert({
        tenant_id: params.tenantId,
        branch_id: params.branchId ?? null,
        follow_up_date: params.followUpDate,
        seller_user_id: params.sellerUserId,
        note: trimmed,
        updated_by: params.updatedByUserId,
        updated_at: now,
      })
      .select('*')
      .single()

    if (insertError) throw formatSellerFollowUpError(insertError)
    return inserted as SellerFollowUpNoteRow
  },
}
