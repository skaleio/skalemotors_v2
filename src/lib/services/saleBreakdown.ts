import { supabase } from '../supabase'
import type { Database } from '../types/database'
import {
  construirSnapshot,
  type CascadaSettings,
  type SaleCascadeInput,
} from '../finance/saleBreakdownSnapshot'

type Row = Database['public']['Tables']['sale_breakdown']['Row']
type Insert = Database['public']['Tables']['sale_breakdown']['Insert']

export interface LibroVentaRow extends Row {
  sale: {
    client_name: string | null
    vehicle_description: string | null
    seller_name: string | null
    sale_date: string | null
  } | null
}

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

  // Próximo N° correlativo del libro para el tenant actual (RLS).
  async nextNumeroVenta(): Promise<number> {
    const { data, error } = await supabase
      .from('sale_breakdown')
      .select('numero_venta')
      .order('numero_venta', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return Number(data?.numero_venta ?? 0) + 1
  },

  // Calcula la cascada y congela el snapshot de la venta (upsert por sale_id).
  async saveForSale(
    saleId: string,
    tenantId: string,
    input: SaleCascadeInput,
    settings: CascadaSettings,
    extras?: {
      numeroVenta?: number | null
      consignadorNombre?: string | null
      primerPago?: number
      pagoFinal?: number
    },
  ): Promise<Row> {
    const s = construirSnapshot(input, settings)
    const payload: Insert = {
      sale_id: saleId,
      tenant_id: tenantId,
      numero_venta: extras?.numeroVenta ?? null,
      consignador_nombre: extras?.consignadorNombre ?? null,
      primer_pago: extras?.primerPago ?? 0,
      pago_final: extras?.pagoFinal ?? 0,
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

  // Filas del Libro de Ventas del tenant actual (RLS filtra por tenant), con datos de la venta.
  async listLibro(): Promise<LibroVentaRow[]> {
    const { data, error } = await supabase
      .from('sale_breakdown')
      .select(
        '*, sale:sales!sale_breakdown_sale_id_fkey(client_name, vehicle_description, seller_name, sale_date)',
      )
      .order('numero_venta', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as unknown as LibroVentaRow[]
  },
}
