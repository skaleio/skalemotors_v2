import { supabase } from '../supabase'

const BUCKET = 'site-assets'

async function resolveTenantId(fallback?: string): Promise<string> {
  if (fallback) return fallback
  const { data, error } = await supabase.rpc('current_tenant_id')
  if (error || !data) {
    throw new Error('No se pudo determinar el tenant para subir la imagen.')
  }
  return data as unknown as string
}

function sanitizeExt(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg'
}

export const siteAssetsService = {
  /**
   * Sube una imagen al bucket `site-assets` dentro de la carpeta del tenant.
   * Las políticas de Storage garantizan que solo se pueda escribir en {tenant_id}/...
   * Devuelve la URL pública (el bucket es público para servir la vitrina).
   */
  async uploadImage(file: File, tenantId?: string): Promise<string> {
    const tid = await resolveTenantId(tenantId)
    const ext = sanitizeExt(file)
    const path = `${tid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) throw error

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return publicUrl
  },
}
