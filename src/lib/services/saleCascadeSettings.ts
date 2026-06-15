import { supabase } from '../supabase'
import type { Database } from '../types/database'
import type { CascadaSettings } from '../finance/saleBreakdownSnapshot'
import type { SocioParametro } from '../finance/saleCascade'

type Row = Database['public']['Tables']['sale_cascade_settings']['Row']

function rowToSettings(r: Row): CascadaSettings {
  return {
    comisionVentaDefault: Number(r.comision_venta_default),
    comisionConsignadorDefault: Number(r.comision_consignador_default),
    pctGerencia: Number(r.pct_gerencia),
    socios: ((r.socios as unknown as SocioParametro[]) ?? []),
  }
}

export const saleCascadeSettingsService = {
  // Parámetros de la cascada del tenant actual (RLS filtra por tenant).
  async getByTenant(tenantId: string): Promise<CascadaSettings | null> {
    const { data, error } = await supabase
      .from('sale_cascade_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error
    return data ? rowToSettings(data as Row) : null
  },

  // Settings del tenant actual sin pasar id (RLS filtra por tenant).
  async getCurrent(): Promise<CascadaSettings | null> {
    const { data, error } = await supabase
      .from('sale_cascade_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? rowToSettings(data as Row) : null
  },

  async upsert(tenantId: string, settings: CascadaSettings): Promise<void> {
    const { error } = await supabase.from('sale_cascade_settings').upsert({
      tenant_id: tenantId,
      comision_venta_default: settings.comisionVentaDefault,
      comision_consignador_default: settings.comisionConsignadorDefault,
      pct_gerencia: settings.pctGerencia,
      socios: settings.socios as unknown as Row['socios'],
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  },
}
