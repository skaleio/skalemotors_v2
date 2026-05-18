import { supabase } from '../supabase'
import type { Database } from '../types/database'

export type LeadNote = Database['public']['Tables']['lead_notes']['Row']
type LeadNoteInsert = Database['public']['Tables']['lead_notes']['Insert']
type LeadNoteUpdate = Database['public']['Tables']['lead_notes']['Update']

type LeadNoteWithAuthor = LeadNote & {
  author?: { id: string; full_name: string | null; email: string | null } | null
}

export const leadNoteService = {
  async listByLead(leadId: string) {
    const { data, error } = await supabase
      .from('lead_notes')
      .select('*, author:users!created_by(id, full_name, email)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data as LeadNoteWithAuthor[]
  },

  async create(params: {
    leadId: string
    body: string
    tenantId: string
    branchId?: string | null
    createdBy?: string | null
  }) {
    const body = params.body.trim()
    if (!body) throw new Error('La nota no puede estar vacía.')

    const row: LeadNoteInsert = {
      lead_id: params.leadId,
      body,
      tenant_id: params.tenantId,
      branch_id: params.branchId ?? null,
      created_by: params.createdBy ?? null,
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .insert(row)
      .select('*, author:users!created_by(id, full_name, email)')
      .single()

    if (error) throw error
    return data as LeadNoteWithAuthor
  },

  async update(noteId: string, body: string) {
    const trimmed = body.trim()
    if (!trimmed) throw new Error('La nota no puede estar vacía.')

    const payload: LeadNoteUpdate = {
      body: trimmed,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .update(payload)
      .eq('id', noteId)
      .select('*, author:users!created_by(id, full_name, email)')
      .single()

    if (error) throw error
    return data as LeadNoteWithAuthor
  },
}
