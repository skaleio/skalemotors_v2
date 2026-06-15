import { supabase } from '../supabase'
import type { Database } from '../types/database'
import {
  construirSnapshot,
  type CascadaSettings,
  type SaleCascadeInput,
} from '../finance/saleBreakdownSnapshot'

type Row = Database['public']['Tables']['sale_breakdown']['Row']
type Insert = Database['public']['Tables']['sale_breakdown']['Insert']

export const saleBreakdownService = {
  async getBySale(saleId: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('sale_breakdown')
      .select('*')
      .eq('sale_id', saleId)
      .maybeSingle()
    if (error) throw error
    return (data as Row) ?? null
  },

  // Calcula la cascada y congela el snapshot de la venta (upsert por sale_id).
  async saveForSale(
    saleId: string,
    tenantId: string,
    input: SaleCascadeInput,
    settings: CascadaSettings,
  ): Promise<Row> {
    const s = construirSnapshot(input, settings)
    const payload: Insert = {
      sale_id: saleId,
      tenant_id: tenantId,
      precio_total: s.precio_total,
      pie: s.pie,
      precio_consignacion: s.precio_consignacion,
      gasto_general: s.gasto_general,
      comision_venta: s.comision_venta,
      comision_consignador: s.comision_consignador,
      pct_gerencia: s.pct_gerencia,
      socios_params: s.socios_params as unknown as Insert['socios_params'],
      saldo_precio: s.saldo_precio,
      utilidad_bruta: s.utilidad_bruta,
      gasto_total: s.gasto_total,
      utilidad_antes_gerencia: s.utilidad_antes_gerencia,
      comision_gerencia: s.comision_gerencia,
      utilidad_post_gerencia: s.utilidad_post_gerencia,
      socios_montos: s.socios_montos as unknown as Insert['socios_montos'],
      utilidad_final_miami: s.utilidad_final_miami,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('sale_breakdown')
      .upsert(payload, { onConflict: 'sale_id' })
      .select()
      .single()
    if (error) throw error
    return data as Row
  },
}
