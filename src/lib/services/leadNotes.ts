import { supabase } from '../supabase'
import type { Database } from '../types/database'
import { optimizeVehicleImageForUpload } from '../vehicleImageOptimize'
import {
  buildLeadNoteAttachmentPath,
  LEAD_NOTE_ATTACHMENTS_BUCKET,
  parseAttachments,
  type LeadNoteAttachment,
  type LeadNoteAttachmentWithUrl,
} from '../leadNoteAttachments'

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

export type LeadNoteWithAuthor = LeadNote & {
  author?: { id: string; full_name: string | null; email: string | null } | null
  /** Adjuntos con signed URL listos para mostrar (resueltos al listar). */
  attachmentsResolved?: LeadNoteAttachmentWithUrl[]
}

const SIGNED_URL_TTL_SECONDS = 3600

/** Genera signed URLs (bucket privado) en una sola llamada para varios adjuntos. */
async function signLeadNoteAttachments(
  attachments: LeadNoteAttachment[],
): Promise<LeadNoteAttachmentWithUrl[]> {
  if (!attachments.length) return []
  const { data, error } = await supabase.storage
    .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
    .createSignedUrls(attachments.map((a) => a.path), SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return attachments.flatMap((a) => {
    const url = urlByPath.get(a.path)
    return url ? [{ ...a, url }] : []
  })
}

/** Resuelve los adjuntos de varias notas con un solo request de signed URLs. */
async function resolveNotesAttachments(notes: LeadNoteWithAuthor[]): Promise<LeadNoteWithAuthor[]> {
  const parsed = notes.map((n) => parseAttachments((n as LeadNote).attachments))
  const allPaths = parsed.flat()
  if (!allPaths.length) {
    return notes.map((n) => ({ ...n, attachmentsResolved: [] }))
  }
  const signed = await signLeadNoteAttachments(allPaths)
  const urlByPath = new Map(signed.map((s) => [s.path, s.url]))
  return notes.map((n, i) => ({
    ...n,
    attachmentsResolved: parsed[i].flatMap((a) => {
      const url = urlByPath.get(a.path)
      return url ? [{ ...a, url }] : []
    }),
  }))
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
      return resolveNotesAttachments((plain ?? []) as LeadNoteWithAuthor[])
    }
    return resolveNotesAttachments(data as LeadNoteWithAuthor[])
  },

  /** Notas de vendedor previas al modelo por canal (channel IS NULL). */
  async listLegacyByLead(leadId: string) {
    const { data, error } = await supabase
      .from('lead_notes')
      .select('*, author:users!created_by(id, full_name, email)')
      .eq('lead_id', leadId)
      .eq('source', 'vendor')
      .is('channel', null)
      .order('created_at', { ascending: true })

    if (error) {
      const { data: plain, error: plainError } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .eq('source', 'vendor')
        .is('channel', null)
        .order('created_at', { ascending: true })
      if (plainError) throw plainError
      return resolveNotesAttachments((plain ?? []) as LeadNoteWithAuthor[])
    }
    return resolveNotesAttachments(data as LeadNoteWithAuthor[])
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

  /** Optimiza y sube imágenes al bucket privado bajo {tenant}/{lead}/{note}/. */
  async uploadAttachments(
    files: File[],
    ctx: { tenantId: string; leadId: string; noteId: string },
  ): Promise<LeadNoteAttachment[]> {
    const uploaded: LeadNoteAttachment[] = []
    for (const file of files) {
      const optimized = await optimizeVehicleImageForUpload(file)
      const path = buildLeadNoteAttachmentPath({
        tenantId: ctx.tenantId,
        leadId: ctx.leadId,
        noteId: ctx.noteId,
        fileName: optimized.name,
        mime: optimized.type,
      })
      const { error } = await supabase.storage
        .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
        .upload(path, optimized, { cacheControl: '3600', upsert: false, contentType: optimized.type })
      if (error) throw error
      uploaded.push({ path, name: file.name, size: optimized.size, mime: optimized.type })
    }
    return uploaded
  },

  async create(params: {
    leadId: string
    body: string
    tenantId: string
    branchId?: string | null
    createdBy?: string | null
    channel?: 'llamada' | 'whatsapp' | null
    nextActionAt?: string | null
    files?: File[]
  }) {
    const body = params.body.trim()
    const files = params.files ?? []
    if (!body && !files.length) throw new Error('La nota no puede estar vacía.')

    const noteId = crypto.randomUUID()
    let attachments: LeadNoteAttachment[] = []
    try {
      if (files.length) {
        attachments = await this.uploadAttachments(files, {
          tenantId: params.tenantId,
          leadId: params.leadId,
          noteId,
        })
      }

      const row: LeadNoteInsert = {
        id: noteId,
        lead_id: params.leadId,
        body,
        tenant_id: params.tenantId,
        branch_id: params.branchId ?? null,
        created_by: params.createdBy ?? null,
        source: 'vendor',
        channel: params.channel ?? null,
        next_action_at: params.nextActionAt ?? null,
        attachments: attachments as never,
      }

      const { data, error } = await supabase
        .from('lead_notes')
        .insert(row)
        .select('*, author:users!created_by(id, full_name, email)')
        .single()

      if (error) throw error
      const resolved = await signLeadNoteAttachments(attachments)
      return { ...(data as LeadNoteWithAuthor), attachmentsResolved: resolved }
    } catch (err) {
      // Evitar archivos huérfanos si la inserción de la nota falla.
      if (attachments.length) {
        await supabase.storage
          .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
          .remove(attachments.map((a) => a.path))
          .catch(() => {})
      }
      throw err
    }
  },

  async update(
    noteId: string,
    body: string,
    opts?: {
      tenantId?: string
      leadId?: string
      /** Adjuntos existentes que se conservan (los no incluidos se eliminan). */
      keepAttachments?: LeadNoteAttachment[]
      /** Imágenes nuevas a subir y agregar. */
      addFiles?: File[]
      /** Paths de adjuntos a borrar del storage tras persistir. */
      removePaths?: string[]
    },
  ) {
    const trimmed = body.trim()
    const hasPhotoOps =
      !!opts &&
      (opts.addFiles !== undefined ||
        opts.removePaths !== undefined ||
        opts.keepAttachments !== undefined)

    let attachments: LeadNoteAttachment[] | undefined
    let uploaded: LeadNoteAttachment[] = []
    if (hasPhotoOps) {
      const kept = opts!.keepAttachments ?? []
      if (opts!.addFiles?.length) {
        if (!opts!.tenantId || !opts!.leadId) {
          throw new Error('Falta el tenant o el lead para subir las imágenes.')
        }
        uploaded = await this.uploadAttachments(opts!.addFiles, {
          tenantId: opts!.tenantId,
          leadId: opts!.leadId,
          noteId,
        })
      }
      attachments = [...kept, ...uploaded]
    }

    if (!trimmed && !(attachments && attachments.length)) {
      throw new Error('La nota no puede estar vacía.')
    }

    const payload: LeadNoteUpdate = {
      body: trimmed,
      updated_at: new Date().toISOString(),
    }
    if (attachments) payload.attachments = attachments as never

    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .update(payload)
        .eq('id', noteId)
        .select('*, author:users!created_by(id, full_name, email)')
        .single()

      if (error) throw error

      // Borrar del storage los adjuntos quitados, solo tras persistir el cambio.
      if (opts?.removePaths?.length) {
        await supabase.storage
          .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
          .remove(opts.removePaths)
          .catch(() => {})
      }

      if (!attachments) return data as LeadNoteWithAuthor
      const resolved = await signLeadNoteAttachments(attachments)
      return { ...(data as LeadNoteWithAuthor), attachmentsResolved: resolved }
    } catch (err) {
      // Evitar archivos huérfanos si la actualización falla tras subir.
      if (uploaded.length) {
        await supabase.storage
          .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
          .remove(uploaded.map((a) => a.path))
          .catch(() => {})
      }
      throw err
    }
  },

  /** Edita body y adjuntos: sube nuevas imágenes, conserva las elegidas y borra las quitadas. */
  async updateWithAttachments(params: {
    noteId: string
    body: string
    tenantId: string
    leadId: string
    keep: LeadNoteAttachment[]
    newFiles: File[]
    removedPaths: string[]
  }) {
    const trimmed = params.body.trim()
    const newFiles = params.newFiles ?? []

    const uploaded = newFiles.length
      ? await this.uploadAttachments(newFiles, {
          tenantId: params.tenantId,
          leadId: params.leadId,
          noteId: params.noteId,
        })
      : []

    const finalAttachments = [...params.keep, ...uploaded]
    if (!trimmed && !finalAttachments.length) {
      if (uploaded.length) {
        await supabase.storage
          .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
          .remove(uploaded.map((a) => a.path))
          .catch(() => {})
      }
      throw new Error('La nota no puede quedar vacía.')
    }

    const payload: LeadNoteUpdate = {
      body: trimmed,
      attachments: finalAttachments as never,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .update(payload)
      .eq('id', params.noteId)
      .select('*, author:users!created_by(id, full_name, email)')
      .single()

    if (error) {
      if (uploaded.length) {
        await supabase.storage
          .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
          .remove(uploaded.map((a) => a.path))
          .catch(() => {})
      }
      throw error
    }

    if (params.removedPaths.length) {
      await supabase.storage
        .from(LEAD_NOTE_ATTACHMENTS_BUCKET)
        .remove(params.removedPaths)
        .catch(() => {})
    }

    const resolved = await signLeadNoteAttachments(finalAttachments)
    return { ...(data as LeadNoteWithAuthor), attachmentsResolved: resolved }
  },

  async delete(noteId: string) {
    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId)
    if (error) throw error
  },
}
