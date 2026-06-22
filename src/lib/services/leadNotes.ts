import { supabase } from '../supabase'
import type { Database } from '../types/database'

export type LeadNote = Database['public']['Tables']['lead_notes']['Row']
export type LeadNoteArchive = {
  id: string
  note_id: string
  lead_id: string
  tenant_id: string
  branch_id: string | null
  body: string
  created_by: string | null
  note_created_at: string
  note_updated_at: string | null
  source: string
  archived_at: string
  archive_action: string
  archived_by: string | null
}
type LeadNoteInsert = Database['public']['Tables']['lead_notes']['Insert']
type LeadNoteUpdate = Database['public']['Tables']['lead_notes']['Update']

type LeadNoteWithAuthor = LeadNote & {
  author?: { id: string; full_name: string | null; email: string | null } | null
}

export const leadNoteService = {
  async listByLead(leadId: string, channel?: 'llamada' | 'whatsapp') {
    let query = supabase
      .from('lead_notes')
      .select('*, author:users!created_by(id, full_name, email)')
      .eq('lead_id', leadId)
      .eq('source', 'vendor')
    if (channel) query = query.eq('channel', channel)
    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) {
      let plainQuery = supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .eq('source', 'vendor')
      if (channel) plainQuery = plainQuery.eq('channel', channel)
      const { data: plain, error: plainError } = await plainQuery.order('created_at', {
        ascending: true,
      })
      if (plainError) throw plainError
      return (plain ?? []) as LeadNoteWithAuthor[]
    }
    return data as LeadNoteWithAuthor[]
  },

  async listArchiveByLead(leadId: string) {
    const { data, error } = await supabase
      .from('lead_notes_archive')
      .select('*')
      .eq('lead_id', leadId)
      .order('archived_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as LeadNoteArchive[]
  },

  async create(params: {
    leadId: string
    body: string
    tenantId: string
    branchId?: string | null
    createdBy?: string | null
    channel?: 'llamada' | 'whatsapp' | null
    nextActionAt?: string | null
  }) {
    const body = params.body.trim()
    if (!body) throw new Error('La nota no puede estar vacía.')

    const row: LeadNoteInsert = {
      lead_id: params.leadId,
      body,
      tenant_id: params.tenantId,
      branch_id: params.branchId ?? null,
      created_by: params.createdBy ?? null,
      source: 'vendor',
      channel: params.channel ?? null,
      next_action_at: params.nextActionAt ?? null,
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

  async delete(noteId: string) {
    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId)
    if (error) throw error
  },
}
